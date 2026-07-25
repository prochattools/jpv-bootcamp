# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code

## Goal
Harden, deploy, and finish JPV staging proof (4-phase)

## Status
Phase 4 COMPLETE — terminal state: **STAGING PARTIAL — NO-GO** (2026-07-25)

## What was accomplished

### Phase 1: Harden operator-actions route
- Auth: admin-only enforcement (403 for unauthed + members)
- Input: provider ID pattern rejection (sub_, cus_, pi_, pm_, etc.)
- Record resolution: server-side findByID before action creation
- Error redaction: only stable codes returned, no internal messages/stacks
- Response: returns only {id, status, actionType} — never full doc

### Phase 2: Validate + commit
- 22 executable unit tests (vi.mock pattern, not source-text assertions)
- TypeScript clean, production build pass
- Committed as `032a326 fix: harden staging operator actions`

### Phase 3: Deploy
- Deployed via GitHub Actions run #30159802976 (success)
- Health: HTTP 200 at https://preview.jpvbootcamp.com

### Phase 4: Close gaps — live proof
- **Stripe**: Webhook signature verification PROVEN (synthetic signed webhook accepted), real event delivery pending Stripe retry window (~1hr for new endpoint)
- **LiveKit**: FULLY PROVEN — host (canPublish=true) + member (canPublish=false) room join tokens issued for live session 21
- **Browser**: PROVEN via Playwright — login page renders, JPV branding, access control correctly denies billing_hold member
- **Bunny**: Application path proven (signed HLS URL, denial for unauthed/unenrolled), real upload pending
- **Email**: Route validated (correct denial for already-queued event), end-to-end pending fresh failed event
- **Operator actions**: Route fully proven (auth, validation, resolution, redaction). afterChange hooks blocked by member 34 in billing_hold.

## Canonical values (DO NOT CHANGE)
- Webhook secret: `whsec_Pw08DKJ5xZwItRUdUKjtoSsDMLisoiio`
- Stripe endpoint: `we_1Tx5xkLIsSm7aAuaNaKmW9Kr`
- Env file: `.env.production` (never `.env.production.BAK`)
- Subscription: `sub_1Tx4JALIsSm7aAuaeeJTk67T`
- Member: id=34, email=info@prochat.tools, status=blocked/billing_hold

## Next steps (operator actions required)
1. Check Stripe Dashboard > Webhooks in ~1hr for delivery confirmation
2. Unblock member 34 → retry billing operator action
3. Create fresh failed email event → retry via operator-actions route
4. Optional: Bunny real upload

## Full evidence
See `docs/CURRENT_WORK_HANDOFF.md` § Terminal State
