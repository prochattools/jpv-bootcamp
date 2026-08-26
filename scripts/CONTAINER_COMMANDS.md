# Container Remediation Commands — Dokploy Staging Terminal

## Context

- Container: `clients-jpv-bootcamp-app-tp9xrk` (applicationId: `I_2Vukga3cc3ZhaG-mUzU`)
- `DATABASE_URL` is confirmed present (env probe: `env | cut -d= -f1 | grep DATABASE`)
- `NODE_PATH=/script-deps/node_modules` — `require('pg')` works directly
- `psql` is installed at postgresql-client-15
- Working directory: `/app`
- Target: `jpvbootcamp_staging` schema, member id=9 only

---

## Step 0 — Schema Guard (run first, verify before proceeding)

```sh
node -e "
const url = new URL(process.env.DATABASE_URL);
console.log('host:', url.hostname);
console.log('schema:', url.searchParams.get('schema'));
if (url.hostname !== '100.71.31.88') { console.error('WRONG HOST — ABORT'); process.exit(1); }
if (url.searchParams.get('schema') !== 'jpvbootcamp_staging') { console.error('WRONG SCHEMA — ABORT'); process.exit(1); }
console.log('GUARD PASSED');
"
```

Expected:
```
host: 100.71.31.88
schema: jpvbootcamp_staging
GUARD PASSED
```

---

## Step 1 — DB Proof + Member Backup (read-only)

```sh
psql "$DATABASE_URL" -c "SELECT current_database(), inet_server_addr();"
psql "$DATABASE_URL" -c "SELECT id, account_status, email_verified_at FROM jpvbootcamp_staging.payload_members WHERE id=9;"
```

Expected: `current_database` shows jpvbootcamp_staging, `inet_server_addr` shows 100.71.31.88, member row returned.

---

## Step 2 — Update Email + Invalidate Stale Tokens

```sh
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
```

Expected: `UPDATE 1` for member, `UPDATE N` (0 or more) for tokens.

---

## Step 3 — Trigger Password Reset

```sh
curl -s -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H 'Content-Type: application/json' \
  -d '{"email":"jpvbootcamp@prochat.tools"}'
```

Expected: `{"ok":true,...}`

**Wait 2 seconds** for the DB write to complete, then run Step 4.

---

## Step 4 — Extract Reset Token from DB

```sh
sleep 2
psql "$DATABASE_URL" -t -A -c "
SELECT metadata->>'actionUrl'
FROM jpvbootcamp_staging.payload_email_events
WHERE template_key = 'member-password-reset'
  AND to_email = 'jpvbootcamp@prochat.tools'
ORDER BY created_at DESC
LIMIT 1;
" | tee /tmp/reset_action_url.txt
```

This prints the full `https://preview.jpvbootcamp.com/reset-password?token=...` URL.

Extract the token:
```sh
RESET_TOKEN=$(cat /tmp/reset_action_url.txt | sed 's/.*[?&]token=//; s/&.*//')
echo "Token prefix: ${RESET_TOKEN:0:8}..."
```

---

## Step 5 — Generate Password + Complete Reset

```sh
NEW_PASS="Stg$(node -e "process.stdout.write(require('crypto').randomBytes(6).toString('hex').toUpperCase())")!9z"
echo "NEW_PASS prefix: ${NEW_PASS:0:4}..."

curl -s -X POST https://preview.jpvbootcamp.com/api/member-password/reset \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"$NEW_PASS\",\"passwordConfirmation\":\"$NEW_PASS\"}"
```

Expected: `{"ok":true,...}`

**Save `$NEW_PASS` to your local secret manager now before closing this terminal.**

---

## Step 6 — Revoke All Sessions

```sh
psql "$DATABASE_URL" -c "
DELETE FROM jpvbootcamp_staging.payload_members_sessions WHERE _parent_id = 9;
"
```

Expected: `DELETE N`

---

## Step 7 — Prove Old Password Fails (HTTP 401)

Replace `<OLD-PASSWORD>` with the previously exposed staging credential (from your records):

```sh
curl -s -o /dev/null -w "HTTP_STATUS: %{http_code}\n" \
  -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jpvbootcamp@prochat.tools","password":"<OLD-PASSWORD>"}'
```

Expected: `HTTP_STATUS: 401`

---

## Step 8 — Prove New Password Works (HTTP 200 + JWT)

```sh
curl -s -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"jpvbootcamp@prochat.tools\",\"password\":\"$NEW_PASS\"}"
```

Expected: HTTP 200, `"token":"eyJ..."`, `"user":{"id":9,"accountStatus":"active"}`

---

## Step 9 — Member Count

```sh
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS total_members FROM jpvbootcamp_staging.payload_members;"
```

---

## Step 10 — Cleanup

```sh
rm -f /tmp/reset_action_url.txt /tmp/reset_token.txt
echo "Temp files cleaned"
```

---

## After Completion

1. **Copy `$NEW_PASS`** to your local secret manager before closing the terminal.
2. **Record evidence** (for the canonical report):
   - Step 7 output: `HTTP_STATUS: 401`
   - Step 8 output: HTTP 200 body (redact JWT, keep `user.id`, `accountStatus`)
3. **Proceed to D/E browser verification** (OPERATOR_MAILBOX_BROWSER_CHECKLIST_2026_07_20.md)
4. **Update** `docs/REMEDIATION_FINAL_REPORT_2026_07_20.md` with completion timestamp and evidence.

---

## Troubleshooting

### psql auth error
```sh
# Try explicit connection params
psql "$(echo $DATABASE_URL | sed 's/?.*$//')" -c "SELECT 1;"
```

### pg module not found in node scripts
```sh
# NODE_PATH is /script-deps/node_modules — verify:
node -e "console.log(require.resolve('pg'))"
# Should show /script-deps/node_modules/pg/lib/index.js
```

### Reset token expired (5-minute window)
```sh
# Re-issue reset — invalidate first, then trigger again
psql "$DATABASE_URL" -c "UPDATE jpvbootcamp_staging.payload_member_verification_tokens SET invalidated_at=now(), updated_at=now() WHERE member_id=9 AND purpose='password_reset' AND consumed_at IS NULL AND invalidated_at IS NULL;"
curl -s -X POST https://preview.jpvbootcamp.com/api/member-password/forgot -H 'Content-Type: application/json' -d '{"email":"jpvbootcamp@prochat.tools"}'
sleep 2
# Then repeat Step 4
```
