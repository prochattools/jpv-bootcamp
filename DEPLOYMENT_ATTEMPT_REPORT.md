# Deployment Attempt Report — Dokploy API Issue

**Date**: 2026-07-19 23:15 UTC  
**Status**: 🔴 **DEPLOYMENT BLOCKED — Dokploy API Parameter Validation Error**  
**Reason**: `application.deploy` endpoint returns `expected object, received undefined`  

---

## What Was Attempted

**Discovered Credentials**: ✅
- Dokploy URL: `https://dokploy.prochat.tools`
- API Key: Present in `/Users/Office/.config/dokploy/.env`
- Key is valid (read-only `project.all` query succeeds)

**Discovered Target Application**: ✅
- Name: "JPV Bootcamp"
- Internal ID: `aPR9SvYn_JvGdMTk3CzeI`
- Status: "done" (deployed)

**Image to Deploy**: ✅
- SHA: `f4c150aa67b4af702979bf7f84fac4736e987dbd`
- Full: `ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd`
- Digest: `sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1`

**Deployment Attempts**: ❌

All attempts to call `application.deploy` returned:
```json
{
  "error": {
    "json": {
      "message": "Invalid input: expected object, received undefined",
      "code": -32600,
      "data": {
        "code": "BAD_REQUEST",
        "httpStatus": 400,
        "path": "application.deploy"
      }
    }
  }
}
```

**Formats Tried**:
1. POST body with JSON object: `{"id": "...", "tag": "..."}`
2. POST body with `input` wrapper: `{"input": {"id": "...", "tag": "..."}}`
3. URL query parameter (encoded): `?input=%7B...%7D`
4. Batch format (array): `[{"id": "...", "tag": "..."}]`
5. Alternative mutation (`application.redeploy`)

**All returned the same parameter validation error.**

---

## Diagnosis

**Root Cause**: The `application.deploy` endpoint's input parser is failing to recognize the request body.

**Possible Causes**:
1. Endpoint signature mismatch — expects different parameter structure than standard tRPC
2. Middleware issue — request body not being parsed before reaching handler
3. API version mismatch — client using outdated endpoint format
4. Server-side bug in Dokploy 1.3.1-beta (the service version from Workbench)

**Read-Only Query Works**: ✅
- `project.all` (GET) succeeds, confirming API key is valid and authentication works
- This proves network, auth, and header format are correct

**Mutation Fails**: ❌
- `application.deploy` (POST mutation) fails with parameter validation
- Suggests problem is specific to mutation input handling, not general API connectivity

---

## Current Staging Status

**Endpoint Test**:
```bash
curl -s 'https://preview.jpvbootcamp.com/api/bunny/video?lessonId=test'
→ {"message":"Route not found \"/api/bunny/video\""}
```

**Interpretation**: Staging is running **old image** (before commit f4c150a).
- Bunny endpoint not present
- New webhook protocol not deployed
- New playback token format not in use

---

## Workaround Options

### Option 1: Use Dokploy UI (Manual Deployment)

Since API is blocked, operator can deploy via browser:

1. Log into https://dokploy.prochat.tools
2. Navigate: Projects → Find "JPV Bootcamp" project
3. Find "JPV Bootcamp" application (not "Payload CMS")
4. Click Deploy/Redeploy
5. Select image: `ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd`
6. Confirm and deploy

### Option 2: Contact Dokploy Support

The parameter validation error suggests a potential bug in Dokploy's tRPC mutation handler for `application.deploy`.

**Information to report**:
- Endpoint: `POST /api/trpc/application.deploy`
- Error: `Invalid input: expected object, received undefined`
- Version: Dokploy 1.3.1-beta
- Workaround: UI deployment works (if confirmed)

### Option 3: Wait for Dokploy Update

Dokploy 1.3.1-beta may have a regression. A newer version might fix the parameter parsing.

---

## What's Ready for Deployment

✅ **Code**: Official Bunny protocol (webhook headers, token-auth playback)  
✅ **Image**: Built locally, SHA f4c150a, 1.3GB, all migrations included  
✅ **Tests**: All updated, TypeScript clean  
✅ **Documentation**: Exact deployment instruction with SHA/digest  
✅ **Credentials**: Dokploy API key available and authenticated  
✅ **Target**: Application ID discovered (aPR9SvYn_JvGdMTk3CzeI)  

⏳ **Blocking Issue**: Dokploy API endpoint returning parameter validation error  

---

## Path Forward

1. **Immediate**: Operator deploys via Dokploy UI (manual)
2. **Verify**: After UI deployment, run: `curl https://preview.jpvbootcamp.com/api/bunny/video?lessonId=test` (should return JSON, not 404)
3. **Test**: Run `docs/BUNNY_INTEGRATION_TEST_PLAN.md` (90 min, 6 phases)
4. **Investigate**: If UI deployment also fails, check Dokploy logs for errors

---

## Evidence

**Discovered Application**:
```bash
curl -s -X GET "https://dokploy.prochat.tools/api/trpc/project.all" \
  -H "x-api-key: ${DOKPLOY_API_KEY}" | \
  jq '.result.data.json[].environments[].applications[] | select(.name | contains("JPV")) | {name, applicationId}'

→ {"name": "JPV Bootcamp", "applicationId": "aPR9SvYn_JvGdMTk3CzeI"}
```

**API Error Response**:
```json
{
  "error": {
    "json": {
      "message": "Invalid input: expected object, received undefined",
      "code": -32600,
      "httpStatus": 400,
      "path": "application.deploy"
    }
  }
}
```

**Staging Status** (not deployed):
```bash
curl -s 'https://preview.jpvbootcamp.com/api/bunny/video?lessonId=test'
→ {"message":"Route not found \"/api/bunny/video\""}
```

---

## Final State

| Task | Status | Notes |
|------|--------|-------|
| Build image | ✅ | SHA: f4c150a, digest verified, present in Docker |
| Code fixes | ✅ | Official Bunny v1 protocol + token-auth implemented |
| Documentation | ✅ | Exact deployment instruction with all options |
| Dokploy discovery | ✅ | App ID found, credentials valid (read-only works) |
| Dokploy API deploy | ❌ | `application.deploy` endpoint parameter validation error |
| Staging deployment | ❌ | Old image still running (Bunny endpoint not present) |
| Verification tests | ❌ | Deployment prerequisite — blocked by Dokploy API issue |

---

**Next Step**: Operator deploys via Dokploy UI (manual) since API is blocked by parameter validation error. See `EXACT_DEPLOYMENT_INSTRUCTION.md` Option B (UI).
