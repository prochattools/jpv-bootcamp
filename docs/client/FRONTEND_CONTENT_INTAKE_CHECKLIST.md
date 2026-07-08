# Front-End Content Intake Checklist — Version 3.4

**Milestone:** Front-end website go-live, 22 July 2026  
**Branch:** `feature/course-branding-and-preview`  
**Internal delivery / handover buffer:** 23 July 2026  
**Client finished-by date:** 24 July 2026  
**Client content/input due:** Wednesday, 15 July 2026  
**Migrations applied:** No  

---

## Summary

This checklist confirms front-end delivery readiness for the 22 July 2026 go-live milestone. It tracks:
1. Client content/input due 15 July 2026
2. Front-end acceptance criteria (landing page, pricing, checkout, support/pay-it-forward)
3. Hard stops (no migrations, no main branch, no secrets)

**Important:** The front-end website go-live milestone does not authorize migration execution or full platform cutover. That decision remains separate and blocked pending migration approval, staging smoke, provider/email verification, and final acceptance.

---

## Part 1: Client Content/Input Due by 15 July 2026

Client must provide final approval or explicit placeholder approval for:

- [ ] **Hero headline** — Final text or approval to use placeholder ("Train for Property Success with JPV")
- [ ] **Short membership description** — Final text (e.g., "One paid membership")
- [ ] **£80 monthly wording** — Final text or approval (current: "Monthly payments with a 12-month commitment")
- [ ] **£880 annual wording** — Final text or approval (current: "Annual upfront payment" with discount)
- [ ] **Support/pay-it-forward wording** — Final text for Free tier and support page
- [ ] **Testimonials / proof / trust items** — Client assets, if any (optional)
- [ ] **FAQ answers** — Final client copy or approval of placeholder FAQ
- [ ] **Contact / support wording** — Footer support modal text or approval
- [ ] **Partner logos or credibility points** — If needed (optional)
- [ ] **Representative course outline / content** — 8-week structure and module titles
- [ ] **Video / storage usage details** — If needed for member onboarding (optional)

**Input deadline:** All content must be submitted by Wednesday, 15 July 2026 for front-end integration.

---

## Part 2: Front-End Source Verification

Confirm the current branch source matches v3.4 requirements:

- [ ] Landing page loads and renders without errors
- [ ] Pricing section displays:
  - [ ] Free tier (controlled non-paid access for approved support / pay-it-forward)
  - [ ] Pro tier (single paid membership)
  - [ ] Price labels: "£80/mo or £880/yr" are accurate
- [ ] Membership description is clear and updated with client copy (if provided)
- [ ] Monthly checkout CTA visible and active
- [ ] Annual checkout CTA linked or accessible (if payment option is offered)
- [ ] Support/pay-it-forward link visible on landing page and routes to `/sponsored`
- [ ] No legacy language present:
  - [ ] No "VIP" tier
  - [ ] No "exhibitor" tier
  - [ ] No "old portal" references
  - [ ] No WordPress, FluentCRM, or FluentCommunity branding
- [ ] Mobile layout acceptable on all breakpoints
- [ ] Final client copy is approved OR placeholders are explicitly approved by client
- [ ] No migration or cutover claims are shown publicly

---

## Part 3: Front-End Acceptance Checklist

Run static preflight and operator acceptance tests:

**Static Tests (local, no network):**
- [ ] `pnpm staging:static-preflight` passes
  - Includes: `frontend_milestone_static.test.ts` (pricing, copy, checkout, docs)
- [ ] `./node_modules/.bin/tsx scripts/frontend_milestone_static.test.ts` passes explicitly
- [ ] `git diff --check` passes (no whitespace issues)
- [ ] `./node_modules/.bin/tsc --noEmit --pretty false --incremental false` passes (type-check clean)

**Operator Manual Acceptance:**
- [ ] Landing page loads without errors in browser (desktop)
- [ ] Landing page loads without errors in browser (mobile)
- [ ] All CTAs route to correct destinations
- [ ] Pricing section copy matches final client approval
- [ ] Support/pay-it-forward link is visible and functional
- [ ] No console errors or warnings
- [ ] Payment flow (checkout URL structure) is correct

---

## Part 4: Hard Stops

**Do not proceed past this point if:**

- [ ] ❌ Migrations are applied to this branch (they must not be)
- [ ] ❌ `main` branch has been modified (it must remain untouched)
- [ ] ❌ Any secrets, API keys, or passwords are committed or visible in public copy
- [ ] ❌ Migration or cutover readiness is claimed in public UI (not allowed at this stage)
- [ ] ❌ Client content/input has not been received by 15 July 2026 (use placeholders with explicit approval only)

---

## Part 5: Handoff and Next Steps

**When this checklist is complete:**

1. Sign off on front-end website go-live milestone (22 July 2026)
2. Complete internal handover buffer documentation (23 July 2026)
3. Provide operator signed evidence to client by 24 July 2026 (finished-by date)

**After front-end acceptance, remaining work is separate:**

- Migration approval and rehearsal (blocked pending approval)
- Staging smoke verification (operator manual)
- Provider/email live verification (separate evidence path)
- Account-column rename approval (pending)
- Full platform live cutover (after all approvals)

**Blockers that remain:**

- [ ] 15 July client content/input (required before final acceptance)
- [ ] Migration approval from target environment (separate decision)
- [ ] Staging smoke completion (operator manual work)
- [ ] Provider/email live verification (separate operator path)
- [ ] No migrations have been applied (and must not be applied for this milestone)

---

## Related Documents

- [Roadmap Progress Status](./ROADMAP_PROGRESS_STATUS.md)
- [JPV Bootcamp Go-Live Plan v3.4 Summary](./JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md)
- [Operator Handoff Summary](./OPERATOR_HANDOFF_SUMMARY.md)
- [v3.4 Go-Live Plan DOCX](./JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4.docx)
- [Migration Approval Packet](./MIGRATION_APPROVAL_PACKET.md)
- [Status Update Procedure](./STATUS_UPDATE_PROCEDURE.md)
