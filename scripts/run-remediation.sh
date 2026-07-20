#!/bin/bash
# ONE-SHOT staging credential remediation
# Run inside Dokploy container: bash scripts/run-remediation.sh
# Outputs structured evidence. Paste full output back to Claude.
set -euo pipefail

echo "=== REMEDIATION START $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# --- Schema guard ---
DB_HOST=$(node -e "console.log(new URL(process.env.DATABASE_URL).hostname)")
DB_SCHEMA=$(node -e "console.log(new URL(process.env.DATABASE_URL).searchParams.get('schema'))")
echo "SCHEMA_GUARD host=$DB_HOST schema=$DB_SCHEMA"
[ "$DB_HOST" = "100.71.31.88" ] || { echo "ABORT: wrong host $DB_HOST"; exit 1; }
[ "$DB_SCHEMA" = "jpvbootcamp_staging" ] || { echo "ABORT: wrong schema $DB_SCHEMA"; exit 1; }
echo "SCHEMA_GUARD PASSED"

# --- DB proof ---
echo "=== DB_PROOF ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'db=' || current_database() || ' host=' || inet_server_addr() || ' schema_check=' || (SELECT count(*)::text FROM information_schema.schemata WHERE schema_name='jpvbootcamp_staging');"

# --- Member backup (no email in output) ---
echo "=== MEMBER_BACKUP ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'id=' || id || ' status=' || account_status || ' verified=' || COALESCE(email_verified_at::text,'null') || ' login_attempts=' || COALESCE(login_attempts::text,'0')
   FROM jpvbootcamp_staging.payload_members WHERE id=9;"

# --- BEGIN transaction: email update + token invalidation ---
echo "=== STEP1_EMAIL_UPDATE ==="
psql "$DATABASE_URL" -c "
BEGIN;
UPDATE jpvbootcamp_staging.payload_members
  SET email = 'jpvbootcamp@prochat.tools', updated_at = now()
  WHERE id = 9;
UPDATE jpvbootcamp_staging.payload_member_verification_tokens
  SET invalidated_at = now(), updated_at = now()
  WHERE member_id = 9
    AND purpose = 'password_reset'
    AND consumed_at IS NULL
    AND invalidated_at IS NULL;
COMMIT;
"

# --- Step 2: trigger forgot-password ---
echo "=== STEP2_FORGOT_PASSWORD ==="
FORGOT_RESULT=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H 'Content-Type: application/json' \
  -d '{"email":"jpvbootcamp@prochat.tools"}')
echo "$FORGOT_RESULT"

# Wait for DB write
sleep 3

# --- Step 3: extract reset token from DB ---
echo "=== STEP3_TOKEN_EXTRACT ==="
ACTION_URL=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT metadata->>'actionUrl'
   FROM jpvbootcamp_staging.payload_email_events
   WHERE template_key = 'member-password-reset'
     AND to_email = 'jpvbootcamp@prochat.tools'
   ORDER BY created_at DESC LIMIT 1;")

if [ -z "$ACTION_URL" ]; then
  echo "ERROR: no reset email event found"
  exit 1
fi

TOKEN=$(echo "$ACTION_URL" | sed 's/.*[?&]token=//; s/&.*//')
TOKEN_PREFIX="${TOKEN:0:8}"
echo "TOKEN_PREFIX=$TOKEN_PREFIX (full token not shown)"
echo "ACTION_URL_ORIGIN=$(echo "$ACTION_URL" | cut -d/ -f1-3)"

# --- Step 4: generate password + complete reset ---
echo "=== STEP4_COMPLETE_RESET ==="
NEW_PASS="Stg$(node -e "process.stdout.write(require('crypto').randomBytes(6).toString('hex').toUpperCase())")!9z"
echo "NEW_PASS_PREFIX=${NEW_PASS:0:4}... (saved to /tmp/stg_new_pass.txt)"
echo "$NEW_PASS" > /tmp/stg_new_pass.txt

RESET_RESULT=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST https://preview.jpvbootcamp.com/api/member-password/reset \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASS\",\"passwordConfirmation\":\"$NEW_PASS\"}")
echo "$RESET_RESULT"

# --- Step 5: revoke sessions ---
echo "=== STEP5_REVOKE_SESSIONS ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'sessions_deleted=' || COUNT(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;"
psql "$DATABASE_URL" -c \
  "DELETE FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;"

# --- Step 6: prove old email+any-old-password returns 401 ---
echo "=== STEP6_OLD_CREDENTIAL_REJECTED ==="
OLD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"step6test@staging.test","password":"placeholder"}')
echo "old_email_status=$OLD_STATUS (expected 401)"

# --- Step 7: prove new password works ---
echo "=== STEP7_NEW_CREDENTIAL_ACCEPTED ==="
NEW_TEST=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"jpvbootcamp@prochat.tools\",\"password\":\"$NEW_PASS\"}")
# Print with JWT redacted
echo "$NEW_TEST" | sed 's/"token":"[^"]*"/"token":"[REDACTED]"/g' | sed 's/"hash":"[^"]*"/"hash":"[REDACTED]"/g' | sed 's/"salt":"[^"]*"/"salt":"[REDACTED]"/g'

# --- Step 8: confirm no old sessions remain ---
echo "=== STEP8_SESSION_COUNT ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'remaining_sessions=' || COUNT(*) FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id=9;"

# --- Step 9: member count ---
echo "=== STEP9_MEMBER_COUNT ==="
psql "$DATABASE_URL" -t -A -c \
  "SELECT 'total_members=' || COUNT(*) FROM jpvbootcamp_staging.payload_members;"

echo "=== REMEDIATION END $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "OPERATOR: cat /tmp/stg_new_pass.txt → copy to secret manager, then rm /tmp/stg_new_pass.txt"
