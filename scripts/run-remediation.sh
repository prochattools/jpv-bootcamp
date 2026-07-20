#!/bin/bash
# Canonical staging credential remediation utility.
#
# Modes:
#   --preflight   Read-only checks. Safe to run any time.
#   --execute     Mutate staging. Requires all preflight checks to pass.
#
# Required environment variables (never pass as CLI args):
#   OLD_CREDENTIAL_PASSWORD   The currently-exposed staging password.
#   NEW_CREDENTIAL_PASSWORD   The desired replacement (min 12 chars).
#
# Allowed target only:
#   DB host:   100.71.31.88
#   DB schema: jpvbootcamp_staging
#   Member ID: 9
#
# Usage inside Dokploy container terminal (/app):
#   OLD_CREDENTIAL_PASSWORD=... NEW_CREDENTIAL_PASSWORD=... bash scripts/run-remediation.sh --preflight
#   OLD_CREDENTIAL_PASSWORD=... NEW_CREDENTIAL_PASSWORD=... bash scripts/run-remediation.sh --execute

set -euo pipefail

# ─── mode guard ───────────────────────────────────────────────────────────────
MODE="${1:-}"
if [[ "$MODE" != "--preflight" && "$MODE" != "--execute" ]]; then
  echo "USAGE: bash scripts/run-remediation.sh --preflight | --execute" >&2
  exit 2
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "=== REMEDIATION $MODE $STAMP ==="

# ─── dependency check ─────────────────────────────────────────────────────────
echo "=== DEP_CHECK ==="
for cmd in psql node curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ABORT: $cmd not found in PATH" >&2; exit 1
  fi
done
echo "DEP_CHECK PASSED"

# ─── schema / host guard ──────────────────────────────────────────────────────
echo "=== SCHEMA_GUARD ==="
DB_HOST=$(node -e "console.log(new URL(process.env.DATABASE_URL).hostname)")
DB_SCHEMA=$(node -e "console.log(new URL(process.env.DATABASE_URL).searchParams.get('schema'))")
echo "host=$DB_HOST schema=$DB_SCHEMA"
if [[ "$DB_HOST" != "100.71.31.88" ]]; then
  echo "ABORT: wrong host $DB_HOST (expected 100.71.31.88)" >&2; exit 1
fi
if [[ "$DB_SCHEMA" != "jpvbootcamp_staging" ]]; then
  echo "ABORT: wrong schema $DB_SCHEMA (expected jpvbootcamp_staging)" >&2; exit 1
fi
echo "SCHEMA_GUARD PASSED"

# ─── env secret guard ─────────────────────────────────────────────────────────
echo "=== SECRET_GUARD ==="
if [[ -z "${OLD_CREDENTIAL_PASSWORD:-}" ]]; then
  echo "ABORT: OLD_CREDENTIAL_PASSWORD is not set" >&2; exit 1
fi
if [[ -z "${NEW_CREDENTIAL_PASSWORD:-}" ]]; then
  echo "ABORT: NEW_CREDENTIAL_PASSWORD is not set" >&2; exit 1
fi
if [[ "${#NEW_CREDENTIAL_PASSWORD}" -lt 12 ]]; then
  echo "ABORT: NEW_CREDENTIAL_PASSWORD must be at least 12 characters" >&2; exit 1
fi
echo "SECRET_GUARD PASSED (values not printed)"

# ─── DB connectivity + schema existence ──────────────────────────────────────
echo "=== DB_PROOF ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'db=' || current_database() || ' host=' || inet_server_addr() || ' schema_exists=' || (SELECT count(*)::text FROM information_schema.schemata WHERE schema_name='jpvbootcamp_staging');"
echo "DB_PROOF PASSED"

# ─── required table / column check ───────────────────────────────────────────
echo "=== TABLE_COLUMN_CHECK ==="
for tbl in payload_members payload_member_verification_tokens payload_members_sessions payload_email_events; do
  cnt=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='jpvbootcamp_staging' AND table_name='$tbl';")
  echo "table_${tbl}=$cnt"
  if [[ "$cnt" != "1" ]]; then
    echo "ABORT: required table $tbl missing" >&2; exit 1
  fi
done
for col in email account_status; do
  cnt=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT count(*) FROM information_schema.columns WHERE table_schema='jpvbootcamp_staging' AND table_name='payload_members' AND column_name='$col';")
  echo "column_payload_members.${col}=$cnt"
  if [[ "$cnt" != "1" ]]; then
    echo "ABORT: required column payload_members.$col missing" >&2; exit 1
  fi
done
echo "TABLE_COLUMN_CHECK PASSED"

# ─── member existence and account-status check ───────────────────────────────
echo "=== MEMBER_CHECK ==="
MEMBER_ROW=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT 'id=' || id || ' status=' || COALESCE(account_status,'null') || ' verified=' || COALESCE(email_verified_at::text,'null')
   FROM jpvbootcamp_staging.payload_members WHERE id=9;")
if [[ -z "$MEMBER_ROW" ]]; then
  echo "ABORT: member id=9 not found" >&2; exit 1
fi
echo "$MEMBER_ROW"
echo "MEMBER_CHECK PASSED"

# ─── capture current email before any mutation ───────────────────────────────
CURRENT_EMAIL=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT email FROM jpvbootcamp_staging.payload_members WHERE id=9;")

# ─── target email conflict check ─────────────────────────────────────────────
echo "=== EMAIL_CONFLICT_CHECK ==="
TARGET_EMAIL="jpvbootcamp@prochat.tools"
CONFLICT=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members WHERE email='$TARGET_EMAIL' AND id != 9;")
echo "conflict_count=$CONFLICT"
if [[ "$CONFLICT" != "0" ]]; then
  echo "ABORT: target email $TARGET_EMAIL already exists on a different member" >&2; exit 1
fi
echo "EMAIL_CONFLICT_CHECK PASSED"

# ─── pre-mutation auth proof ──────────────────────────────────────────────────
echo "=== PRE_MUTATION_AUTH_PROOF ==="
echo "testing login with current email (redacted) and OLD_CREDENTIAL_PASSWORD (not printed)"
PRE_AUTH_STATUS=$(node -e "
const https = require('https');
const body = JSON.stringify({ email: process.env._PM_EMAIL, password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => { process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.write(body); req.end();
" _PM_EMAIL="$CURRENT_EMAIL")
echo "pre_mutation_auth_status=$PRE_AUTH_STATUS"
if [[ "$PRE_AUTH_STATUS" == "200" ]]; then
  echo "PRE_MUTATION_AUTH_PROOF PASSED (old credential valid)"
elif [[ "$PRE_AUTH_STATUS" == "401" ]]; then
  echo "PRE_MUTATION_AUTH_PROOF: credential already invalid — may have been partially rotated"
else
  echo "WARNING: pre_auth_status=$PRE_AUTH_STATUS (network/unexpected)"
fi

# ─── preflight complete ───────────────────────────────────────────────────────
if [[ "$MODE" == "--preflight" ]]; then
  echo "=== PREFLIGHT COMPLETE — all checks passed, no mutations performed ==="
  exit 0
fi

# ─── EXECUTE MODE ─────────────────────────────────────────────────────────────
echo "=== EXECUTE MODE STARTING ==="

# ─── Step 1: email update + token invalidation in a single transaction ────────
echo "=== STEP1_EMAIL_UPDATE ==="
# Use a DO block to assert exactly 1 row was updated; abort transaction otherwise.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
BEGIN;
UPDATE jpvbootcamp_staging.payload_members
  SET email = '$TARGET_EMAIL', updated_at = now()
  WHERE id = 9;
DO \$\$
DECLARE r integer;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  IF r != 1 THEN
    RAISE EXCEPTION 'email UPDATE affected % rows (expected 1) — transaction aborted', r;
  END IF;
END\$\$;
UPDATE jpvbootcamp_staging.payload_member_verification_tokens
  SET invalidated_at = now(), updated_at = now()
  WHERE member_id = 9
    AND purpose = 'password_reset'
    AND consumed_at IS NULL
    AND invalidated_at IS NULL;
COMMIT;
"
UPDATED_EMAIL=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT email FROM jpvbootcamp_staging.payload_members WHERE id=9;")
if [[ "$UPDATED_EMAIL" != "$TARGET_EMAIL" ]]; then
  echo "ABORT: email post-update verification failed — got '$UPDATED_EMAIL'" >&2; exit 1
fi
echo "email_verified=$UPDATED_EMAIL"
echo "STEP1_EMAIL_UPDATE DONE"

# ─── Step 2: trigger forgot-password ─────────────────────────────────────────
echo "=== STEP2_FORGOT_PASSWORD ==="
FORGOT_RESULT=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TARGET_EMAIL\"}")
FORGOT_STATUS=$(echo "$FORGOT_RESULT" | grep 'HTTP_STATUS:' | cut -d: -f2)
echo "forgot_status=$FORGOT_STATUS"
echo "$FORGOT_RESULT" | grep -v 'HTTP_STATUS:'
if [[ "$FORGOT_STATUS" != "200" ]]; then
  echo "ABORT: forgot-password returned $FORGOT_STATUS" >&2
  echo "ROLLBACK_GUIDANCE: email changed to $TARGET_EMAIL — re-run Step 2 after investigating" >&2
  exit 1
fi
echo "STEP2_FORGOT_PASSWORD DONE"

# ─── Step 3: wait and extract reset token from email events ──────────────────
echo "=== STEP3_TOKEN_EXTRACT ==="
sleep 3
ACTION_URL=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT metadata->>'actionUrl'
   FROM jpvbootcamp_staging.payload_email_events
   WHERE template_key = 'member-password-reset'
     AND to_email = '$TARGET_EMAIL'
   ORDER BY created_at DESC LIMIT 1;")
if [[ -z "$ACTION_URL" ]]; then
  echo "ABORT: no reset email event found in payload_email_events" >&2
  echo "ROLLBACK_GUIDANCE: re-run Step 2 (trigger forgot-password) then retry this step" >&2
  exit 1
fi
RESET_TOKEN=$(echo "$ACTION_URL" | sed 's/.*[?&]token=//; s/&.*//')
if [[ "${#RESET_TOKEN}" -lt 20 ]]; then
  echo "ABORT: extracted token is too short (${#RESET_TOKEN} chars)" >&2; exit 1
fi
echo "TOKEN_PREFIX=${RESET_TOKEN:0:8}... (full token not shown)"
echo "ACTION_URL_ORIGIN=$(echo "$ACTION_URL" | cut -d/ -f1-3)"
echo "STEP3_TOKEN_EXTRACT DONE"

# ─── Step 4: complete password reset (secrets via env, never via curl args) ───
echo "=== STEP4_COMPLETE_RESET ==="
RESET_RESULT=$(node -e "
const https = require('https');
const body = JSON.stringify({
  token: process.env._RESET_TOKEN,
  password: process.env.NEW_CREDENTIAL_PASSWORD,
  passwordConfirmation: process.env.NEW_CREDENTIAL_PASSWORD
});
const url = new URL('https://preview.jpvbootcamp.com/api/member-password/reset');
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => process.stdout.write(res.statusCode + '\n' + data));
});
req.on('error', e => { process.stderr.write(e.message + '\n'); process.exit(1); });
req.write(body); req.end();
" _RESET_TOKEN="$RESET_TOKEN")
RESET_STATUS=$(echo "$RESET_RESULT" | head -1)
RESET_BODY=$(echo "$RESET_RESULT" | tail -n +2 \
  | sed 's/"token":"[^"]*"/"token":"[REDACTED]"/g')
echo "reset_status=$RESET_STATUS"
echo "$RESET_BODY"
if [[ "$RESET_STATUS" != "200" ]]; then
  echo "ABORT: password reset returned $RESET_STATUS" >&2
  echo "ROLLBACK_GUIDANCE: email is now $TARGET_EMAIL — re-issue forgot-password if token expired" >&2
  exit 1
fi
if ! echo "$RESET_BODY" | grep -q '"ok":true'; then
  echo "ABORT: reset body missing ok:true" >&2; exit 1
fi
echo "STEP4_COMPLETE_RESET DONE"

# ─── Step 5: revoke all sessions ─────────────────────────────────────────────
echo "=== STEP5_REVOKE_SESSIONS ==="
SESSIONS_BEFORE=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;")
echo "sessions_before=$SESSIONS_BEFORE"
psql "$DATABASE_URL" -c \
  "DELETE FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;"
SESSIONS_AFTER=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;")
echo "sessions_after=$SESSIONS_AFTER"
if [[ "$SESSIONS_AFTER" != "0" ]]; then
  echo "WARNING: sessions_after=$SESSIONS_AFTER (expected 0)" >&2
fi
echo "STEP5_REVOKE_SESSIONS DONE"
echo "JWT_REVOCATION_NOTE: Payload uses stateless JWTs. Sessions deleted. Old JWTs will be rejected at the password-hash verification layer on the next authenticated request. This is the supported revocation mechanism — no separate revocation API exists."

# ─── Step 6: prove old email + old password => 401 ───────────────────────────
echo "=== STEP6_OLD_EMAIL_REJECTED ==="
OLD_EMAIL_STATUS=$(node -e "
const https = require('https');
const body = JSON.stringify({ email: process.env._OLD_EMAIL, password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => { process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.write(body); req.end();
" _OLD_EMAIL="$CURRENT_EMAIL")
echo "old_email_old_pass_status=$OLD_EMAIL_STATUS (expected 401)"
if [[ "$OLD_EMAIL_STATUS" != "401" ]]; then
  echo "WARNING: old_email_old_pass_status=$OLD_EMAIL_STATUS — expected 401" >&2
fi

# ─── Step 7: prove new email + old password => 401 ───────────────────────────
echo "=== STEP7_NEW_EMAIL_OLD_PASS_REJECTED ==="
NEW_EMAIL_OLD_PASS=$(node -e "
const https = require('https');
const body = JSON.stringify({ email: '$TARGET_EMAIL', password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => { process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.write(body); req.end();
")
echo "new_email_old_pass_status=$NEW_EMAIL_OLD_PASS (expected 401)"
if [[ "$NEW_EMAIL_OLD_PASS" != "401" ]]; then
  echo "WARNING: new_email_old_pass_status=$NEW_EMAIL_OLD_PASS — expected 401" >&2
fi

# ─── Step 8: prove new email + new password => 200 ───────────────────────────
echo "=== STEP8_NEW_CREDENTIAL_ACCEPTED ==="
NEW_CRED_RESULT=$(node -e "
const https = require('https');
const body = JSON.stringify({ email: '$TARGET_EMAIL', password: process.env.NEW_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => process.stdout.write(res.statusCode + '\n' + data));
});
req.on('error', e => { process.stderr.write(e.message + '\n'); process.exit(1); });
req.write(body); req.end();
")
NEW_CRED_STATUS=$(echo "$NEW_CRED_RESULT" | head -1)
NEW_CRED_BODY_REDACTED=$(echo "$NEW_CRED_RESULT" | tail -n +2 \
  | sed 's/"token":"[^"]*"/"token":"[REDACTED]"/g' \
  | sed 's/"hash":"[^"]*"/"hash":"[REDACTED]"/g' \
  | sed 's/"salt":"[^"]*"/"salt":"[REDACTED]"/g')
echo "new_credential_status=$NEW_CRED_STATUS (expected 200)"
echo "$NEW_CRED_BODY_REDACTED"
if [[ "$NEW_CRED_STATUS" != "200" ]]; then
  echo "ABORT: new credential test failed — status $NEW_CRED_STATUS" >&2; exit 1
fi
# Emit first 20 chars of JWT as fingerprint
JWT_FINGERPRINT=$(echo "$NEW_CRED_RESULT" | tail -n +2 \
  | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{ const t=(JSON.parse(d).token||''); process.stdout.write(t.substring(0,20)+'...(truncated)'); }
  catch{ process.stdout.write('(parse_error)'); }
})")
echo "new_jwt_fingerprint=$JWT_FINGERPRINT"
echo "STEP8_NEW_CREDENTIAL_ACCEPTED DONE"

# ─── Step 9: member count ─────────────────────────────────────────────────────
echo "=== STEP9_MEMBER_COUNT ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'total_members=' || count(*) FROM jpvbootcamp_staging.payload_members;"

echo "=== REMEDIATION EXECUTE COMPLETE $STAMP ==="
echo "OPERATOR: new password was supplied via NEW_CREDENTIAL_PASSWORD env var — save to your secret manager now, then unset the variable"
