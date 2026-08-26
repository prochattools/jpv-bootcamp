#!/bin/bash
# Canonical staging credential remediation utility.
#
# Modes:
#   --preflight   Read-only checks. Safe to run any time.
#   --execute     Mutate staging. All preflight checks must pass first.
#
# Secrets — never inline on the command line (shell history exposure).
#   Option A (interactive, recommended):
#     bash scripts/run-remediation.sh --preflight
#     The script prompts with read -s (no echo) when a terminal is available.
#   Option B (secret-manager injection via subshell, not env assignment):
#     Inject via your secret manager; do not pass inline on the command line.
#     Example pattern: export each variable from a secret-manager read command
#     in a separate step before invoking this script.
#
# Allowed target only:
#   DB host:   100.71.31.88
#   DB schema: jpvbootcamp_staging
#   Member ID: 9

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
# Allowed hosts:
#   100.71.31.88  — Tailscale address (reachable from outside the container)
#   10.0.2.4      — Docker overlay address (reachable from inside the Dokploy container)
# Both resolve to the same Supabase staging instance. Schema guard is the hard invariant.
echo "=== SCHEMA_GUARD ==="
DB_HOST=$(node -e "console.log(new URL(process.env.DATABASE_URL).hostname)")
DB_SCHEMA=$(node -e "console.log(new URL(process.env.DATABASE_URL).searchParams.get('schema'))")
echo "host=$DB_HOST schema=$DB_SCHEMA"
if [[ "$DB_HOST" != "100.71.31.88" && "$DB_HOST" != "10.0.2.4" ]]; then
  echo "ABORT: wrong host $DB_HOST (expected 100.71.31.88 or 10.0.2.4)" >&2; exit 1
fi
if [[ "$DB_SCHEMA" != "jpvbootcamp_staging" ]]; then
  echo "ABORT: wrong schema $DB_SCHEMA (expected jpvbootcamp_staging)" >&2; exit 1
fi
echo "SCHEMA_GUARD PASSED"

# ─── build psql-compatible URL (strip ?schema= query param psql does not support) ─────
PSQL_URL=$(node -e "
const u = new URL(process.env.DATABASE_URL);
u.searchParams.delete('schema');
process.stdout.write(u.toString());
")
export PSQL_URL

# ─── interactive secret prompt (if not already set and tty available) ────────
# Prompts are on stderr, no echo. Falls back to ABORT if no tty and env not set.
if [[ -z "${OLD_CREDENTIAL_PASSWORD:-}" ]] && [[ -t 0 ]]; then
  read -rs -p "Enter OLD_CREDENTIAL_PASSWORD (current staging password): " OLD_CREDENTIAL_PASSWORD
  echo "" >&2
fi
if [[ -z "${NEW_CREDENTIAL_PASSWORD:-}" ]] && [[ -t 0 ]]; then
  read -rs -p "Enter NEW_CREDENTIAL_PASSWORD (replacement, min 12 chars): " NEW_CREDENTIAL_PASSWORD
  echo "" >&2
fi
export OLD_CREDENTIAL_PASSWORD NEW_CREDENTIAL_PASSWORD

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
psql "$PSQL_URL" -t -A -c \
  "SELECT 'db=' || current_database() || ' host=' || inet_server_addr() || ' schema_exists=' || (SELECT count(*)::text FROM information_schema.schemata WHERE schema_name='jpvbootcamp_staging');"
echo "DB_PROOF PASSED"

# ─── required table / column check ───────────────────────────────────────────
echo "=== TABLE_COLUMN_CHECK ==="
for tbl in payload_members payload_member_verification_tokens payload_members_sessions payload_email_events; do
  cnt=$(psql "$PSQL_URL" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='jpvbootcamp_staging' AND table_name='$tbl';")
  echo "table_${tbl}=$cnt"
  if [[ "$cnt" != "1" ]]; then
    echo "ABORT: required table $tbl missing" >&2; exit 1
  fi
done
for col in email account_status; do
  cnt=$(psql "$PSQL_URL" -t -A -c \
    "SELECT count(*) FROM information_schema.columns WHERE table_schema='jpvbootcamp_staging' AND table_name='payload_members' AND column_name='$col';")
  echo "column_payload_members.${col}=$cnt"
  if [[ "$cnt" != "1" ]]; then
    echo "ABORT: required column payload_members.$col missing" >&2; exit 1
  fi
done
echo "TABLE_COLUMN_CHECK PASSED"

# ─── member existence and account-status check ───────────────────────────────
echo "=== MEMBER_CHECK ==="
MEMBER_ROW=$(psql "$PSQL_URL" -t -A -c \
  "SELECT 'id=' || id || ' status=' || COALESCE(account_status::text,'null') || ' verified=' || COALESCE(email_verified_at::text,'null')
   FROM jpvbootcamp_staging.payload_members WHERE id=9;")
if [[ -z "$MEMBER_ROW" ]]; then
  echo "ABORT: member id=9 not found" >&2; exit 1
fi
echo "$MEMBER_ROW"
echo "MEMBER_CHECK PASSED"

# ─── capture current email before any mutation ───────────────────────────────
CURRENT_EMAIL=$(psql "$PSQL_URL" -t -A -c \
  "SELECT email FROM jpvbootcamp_staging.payload_members WHERE id=9;")

# ─── target email conflict check ─────────────────────────────────────────────
echo "=== EMAIL_CONFLICT_CHECK ==="
TARGET_EMAIL="jpvbootcamp@prochat.tools"
CONFLICT=$(psql "$PSQL_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members WHERE email='$TARGET_EMAIL' AND id != 9;")
echo "conflict_count=$CONFLICT"
if [[ "$CONFLICT" != "0" ]]; then
  echo "ABORT: target email $TARGET_EMAIL already exists on a different member" >&2; exit 1
fi
echo "EMAIL_CONFLICT_CHECK PASSED"

# ─── pre-mutation auth proof + old JWT capture ───────────────────────────────
echo "=== PRE_MUTATION_AUTH_PROOF ==="
echo "testing login with current email (redacted) and OLD_CREDENTIAL_PASSWORD (not printed)"
PRE_AUTH_RESULT=$(_PM_EMAIL="$CURRENT_EMAIL" node -e "
const https = require('https');
const crypto = require('crypto');
const body = JSON.stringify({ email: process.env._PM_EMAIL, password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    let token = '';
    try { token = JSON.parse(data).token || ''; } catch {}
    // Emit status + SHA-256 fingerprint of JWT (never the token itself)
    const fingerprint = token ? crypto.createHash('sha256').update(token).digest('hex').substring(0,16) : '';
    process.stdout.write(res.statusCode + ' ' + fingerprint);
  });
});
req.on('error', e => { process.stdout.write('net_error 0'); });
req.write(body); req.end();
")

PRE_AUTH_STATUS=$(echo "$PRE_AUTH_RESULT" | cut -d' ' -f1)
PRE_AUTH_JWT_FINGERPRINT=$(echo "$PRE_AUTH_RESULT" | cut -d' ' -f2)

echo "pre_mutation_auth_status=$PRE_AUTH_STATUS"
if [[ "$PRE_AUTH_STATUS" == "net_error" ]]; then
  echo "ABORT: network error contacting login endpoint" >&2; exit 1
fi
if [[ "$PRE_AUTH_STATUS" == "200" ]]; then
  echo "pre_mutation_jwt_sha256_prefix=$PRE_AUTH_JWT_FINGERPRINT (first 16 hex chars of SHA-256)"
  echo "PRE_MUTATION_AUTH_PROOF PASSED (old credential valid)"
elif [[ "$PRE_AUTH_STATUS" == "401" ]]; then
  echo "PRE_MUTATION_AUTH_PROOF: credential already invalid (may have been partially rotated)"
  PRE_AUTH_JWT_FINGERPRINT=""
else
  echo "ABORT: unexpected pre_auth_status=$PRE_AUTH_STATUS" >&2; exit 1
fi

# ─── pre-mutation protected endpoint check (captures old JWT behaviour) ──────
OLD_JWT_PROTECTED_STATUS=""
if [[ -n "$PRE_AUTH_JWT_FINGERPRINT" ]]; then
  echo "=== PRE_MUTATION_PROTECTED_ENDPOINT ==="
  # Obtain old JWT again (same request, same node inline) for use in protected endpoint test.
  # We capture the full token into a shell variable — never echo to stdout.
  OLD_JWT=$(_PM_EMAIL="$CURRENT_EMAIL" node -e "
const https = require('https');
const body = JSON.stringify({ email: process.env._PM_EMAIL, password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try { process.stdout.write(JSON.parse(data).token || ''); } catch {}
  });
});
req.on('error', () => {});
req.write(body); req.end();
")

  if [[ -z "$OLD_JWT" ]]; then
    echo "ABORT: could not obtain old JWT for protected endpoint test" >&2; exit 1
  fi

  OLD_JWT_PROTECTED_STATUS=$(_OLD_JWT="$OLD_JWT" node -e "
const https = require('https');
const url = new URL('https://preview.jpvbootcamp.com/api/member-session');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'GET',
  headers: { Authorization: 'JWT ' + process.env._OLD_JWT }
}, (res) => { res.resume(); process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.end();
")

  if [[ "$OLD_JWT_PROTECTED_STATUS" == "net_error" ]]; then
    echo "ABORT: network error on protected endpoint pre-check" >&2; exit 1
  fi
  echo "pre_mutation_protected_status=$OLD_JWT_PROTECTED_STATUS (expected 200 or 403 — proves endpoint reachable)"
  if [[ "$OLD_JWT_PROTECTED_STATUS" != "200" && "$OLD_JWT_PROTECTED_STATUS" != "403" ]]; then
    echo "ABORT: unexpected protected endpoint status $OLD_JWT_PROTECTED_STATUS" >&2; exit 1
  fi
  echo "PRE_MUTATION_PROTECTED_ENDPOINT DONE"
fi

# ─── preflight complete ───────────────────────────────────────────────────────
if [[ "$MODE" == "--preflight" ]]; then
  echo "=== PREFLIGHT COMPLETE — all checks passed, no mutations performed ==="
  exit 0
fi

# ─── EXECUTE MODE STARTING ────────────────────────────────────────────────────
echo "=== EXECUTE MODE STARTING ==="

# ─── Step 1: email update + token invalidation in a single transaction ────────
echo "=== STEP1_EMAIL_UPDATE ==="
STEP1_RESULT=$(psql "$PSQL_URL" -v ON_ERROR_STOP=1 -qAt -F '|' -c "
BEGIN;
WITH updated_member AS (
  UPDATE jpvbootcamp_staging.payload_members
    SET email = '$TARGET_EMAIL', updated_at = now()
    WHERE id = 9
    RETURNING 1
), invalidated_tokens AS (
  UPDATE jpvbootcamp_staging.payload_member_verification_tokens
    SET invalidated_at = now(), updated_at = now()
    WHERE member_id = 9
      AND purpose = 'password_reset'
      AND consumed_at IS NULL
      AND invalidated_at IS NULL
    RETURNING 1
)
SELECT
  (SELECT count(*) FROM updated_member),
  (SELECT count(*) FROM invalidated_tokens);
COMMIT;
")
MEMBER_UPDATE_COUNT=$(printf '%s\n' "$STEP1_RESULT" | tail -n 1 | cut -d'|' -f1)
TOKENS_INVALIDATED_COUNT=$(printf '%s\n' "$STEP1_RESULT" | tail -n 1 | cut -d'|' -f2)
if [[ "$MEMBER_UPDATE_COUNT" != "1" ]]; then
  echo "ABORT: member email UPDATE affected $MEMBER_UPDATE_COUNT rows; expected 1" >&2; exit 1
fi
UPDATED_EMAIL=$(psql "$PSQL_URL" -t -A -c \
  "SELECT email FROM jpvbootcamp_staging.payload_members WHERE id=9;")
if [[ "$UPDATED_EMAIL" != "$TARGET_EMAIL" ]]; then
  echo "ABORT: email post-update verification failed — got '$UPDATED_EMAIL'" >&2; exit 1
fi
echo "member_update_count=$MEMBER_UPDATE_COUNT expected=1"
echo "tokens_invalidated_count=$TOKENS_INVALIDATED_COUNT"
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
ACTION_URL=$(psql "$PSQL_URL" -t -A -c \
  "SELECT metadata->>'actionUrl'
   FROM jpvbootcamp_staging.payload_email_events
   WHERE template_key = 'member-password-reset'
     AND to_email = '$TARGET_EMAIL'
   ORDER BY created_at DESC LIMIT 1;")
if [[ -z "$ACTION_URL" ]]; then
  echo "ABORT: no reset email event found in payload_email_events" >&2
  echo "ROLLBACK_GUIDANCE: re-run Step 2 then retry" >&2
  exit 1
fi
RESET_TOKEN=$(echo "$ACTION_URL" | sed 's/.*[?&]token=//; s/&.*//')
if [[ "${#RESET_TOKEN}" -lt 20 ]]; then
  echo "ABORT: extracted token is too short (${#RESET_TOKEN} chars)" >&2; exit 1
fi
# Emit SHA-256 fingerprint only — never the raw token
TOKEN_FINGERPRINT=$(_TOKEN="$RESET_TOKEN" node -e "
const crypto = require('crypto');
process.stdout.write(crypto.createHash('sha256').update(process.env._TOKEN).digest('hex').substring(0,16));
")
echo "TOKEN_SHA256_PREFIX=$TOKEN_FINGERPRINT (first 16 hex chars of SHA-256 of token)"
echo "ACTION_URL_ORIGIN=$(echo "$ACTION_URL" | cut -d/ -f1-3)"
echo "STEP3_TOKEN_EXTRACT DONE"

# ─── Step 4: complete password reset (secrets via env, never via curl args) ───
echo "=== STEP4_COMPLETE_RESET ==="
RESET_RESULT=$(_RESET_TOKEN="$RESET_TOKEN" node -e "
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
req.on('error', e => { process.stderr.write('NETWORK_ERROR: ' + e.message + '\n'); process.exit(1); });
req.write(body); req.end();
")
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
SESSIONS_BEFORE=$(psql "$PSQL_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;")
echo "sessions_before=$SESSIONS_BEFORE"
psql "$PSQL_URL" -c \
  "DELETE FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;"
SESSIONS_AFTER=$(psql "$PSQL_URL" -t -A -c \
  "SELECT count(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;")
echo "sessions_after=$SESSIONS_AFTER"
if [[ "$SESSIONS_AFTER" != "0" ]]; then
  echo "ABORT: sessions_after=$SESSIONS_AFTER — expected 0 after DELETE" >&2; exit 1
fi
echo "STEP5_REVOKE_SESSIONS DONE"

# ─── Step 6: prove old email + old password => 401 (FATAL) ───────────────────
echo "=== STEP6_OLD_EMAIL_REJECTED ==="
OLD_EMAIL_STATUS=$(_OLD_EMAIL="$CURRENT_EMAIL" node -e "
const https = require('https');
const body = JSON.stringify({ email: process.env._OLD_EMAIL, password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => { res.resume(); process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.write(body); req.end();
")
echo "old_email_old_pass_status=$OLD_EMAIL_STATUS (expected 401)"
if [[ "$OLD_EMAIL_STATUS" == "net_error" ]]; then
  echo "ABORT: network error testing old email rejection" >&2; exit 1
fi
if [[ "$OLD_EMAIL_STATUS" != "401" ]]; then
  echo "ABORT: old_email_old_pass_status=$OLD_EMAIL_STATUS — expected 401, old credential NOT rejected" >&2; exit 1
fi
echo "STEP6_OLD_EMAIL_REJECTED DONE"

# ─── Step 7: prove new email + old password => 401 (FATAL) ───────────────────
echo "=== STEP7_NEW_EMAIL_OLD_PASS_REJECTED ==="
NEW_EMAIL_OLD_PASS=$(node -e "
const https = require('https');
const body = JSON.stringify({ email: '$TARGET_EMAIL', password: process.env.OLD_CREDENTIAL_PASSWORD });
const url = new URL('https://preview.jpvbootcamp.com/api/payload_members/login');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => { res.resume(); process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.write(body); req.end();
")
echo "new_email_old_pass_status=$NEW_EMAIL_OLD_PASS (expected 401)"
if [[ "$NEW_EMAIL_OLD_PASS" == "net_error" ]]; then
  echo "ABORT: network error testing new email + old password rejection" >&2; exit 1
fi
if [[ "$NEW_EMAIL_OLD_PASS" != "401" ]]; then
  echo "ABORT: new_email_old_pass_status=$NEW_EMAIL_OLD_PASS — expected 401, old password NOT rejected on new email" >&2; exit 1
fi
echo "STEP7_NEW_EMAIL_OLD_PASS_REJECTED DONE"

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
req.on('error', e => { process.stderr.write('NETWORK_ERROR: ' + e.message + '\n'); process.exit(1); });
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
# Emit SHA-256 fingerprint only — never the raw JWT
NEW_JWT_FINGERPRINT=$(echo "$NEW_CRED_RESULT" | tail -n +2 \
  | node -e "
const crypto = require('crypto');
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{
    const t=(JSON.parse(d).token||'');
    if(t) process.stdout.write(crypto.createHash('sha256').update(t).digest('hex').substring(0,16));
    else process.stdout.write('(no_token)');
  } catch{ process.stdout.write('(parse_error)'); }
})")
echo "new_jwt_sha256_prefix=$NEW_JWT_FINGERPRINT (first 16 hex chars of SHA-256)"
echo "STEP8_NEW_CREDENTIAL_ACCEPTED DONE"

# ─── Step 8b: prove old JWT rejected on protected endpoint ───────────────────
echo "=== STEP8B_OLD_JWT_REJECTED ==="
if [[ -n "${OLD_JWT:-}" ]]; then
  POST_ROTATION_STATUS=$(_OLD_JWT="$OLD_JWT" node -e "
const https = require('https');
const url = new URL('https://preview.jpvbootcamp.com/api/member-session');
const req = https.request({
  hostname: url.hostname, path: url.pathname, method: 'GET',
  headers: { Authorization: 'JWT ' + process.env._OLD_JWT }
}, (res) => { res.resume(); process.stdout.write(String(res.statusCode)); });
req.on('error', () => process.stdout.write('net_error'));
req.end();
")

  echo "post_rotation_old_jwt_status=$POST_ROTATION_STATUS"
  if [[ "$POST_ROTATION_STATUS" == "net_error" ]]; then
    echo "ABORT: network error testing old JWT rejection" >&2; exit 1
  fi
  # After password reset + session deletion, old JWT must be rejected (401 or 403)
  if [[ "$POST_ROTATION_STATUS" == "200" ]]; then
    echo "ABORT: old JWT still accepted by protected endpoint after rotation — JWT revocation failed" >&2
    echo "JWT_REVOCATION_NOTE: Payload stateless JWT not properly invalidated. Investigate auth middleware." >&2
    exit 1
  fi
  echo "JWT_REVOCATION_PROOF: old JWT rejected (status=$POST_ROTATION_STATUS) after password reset and session deletion"
  echo "JWT_REVOCATION_MECHANISM: password-hash change invalidates any JWT encoding the old password hash"
  echo "STEP8B_OLD_JWT_REJECTED DONE"
else
  echo "STEP8B_SKIPPED: no pre-mutation old JWT was captured (credential was already invalid at preflight)"
fi

# ─── Step 9: member count ─────────────────────────────────────────────────────
echo "=== STEP9_MEMBER_COUNT ==="
psql "$PSQL_URL" -t -A -c \
  "SELECT 'total_members=' || count(*) FROM jpvbootcamp_staging.payload_members;"

echo "=== REMEDIATION EXECUTE COMPLETE $STAMP ==="
echo "OPERATOR: new password was supplied via NEW_CREDENTIAL_PASSWORD env var — save to your secret manager now, then run: unset OLD_CREDENTIAL_PASSWORD NEW_CREDENTIAL_PASSWORD OLD_JWT"
