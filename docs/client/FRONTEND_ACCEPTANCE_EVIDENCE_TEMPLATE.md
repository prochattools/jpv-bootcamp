# Front-End Acceptance Evidence Template — Version 3.4

**Branch:** `feature/course-branding-and-preview`
**Front-end milestone:** 22 July 2026
**Client content/input due:** 15 July 2026
**Handover buffer:** 23 July 2026
**Client finished-by date:** 24 July 2026
**Migrations applied:** No

---

## Purpose

This template captures manual front-end website acceptance evidence for the 22 July 2026 website milestone.

This template does **not** approve migrations. It does **not** confirm full platform cutover. It should be filled only after actual operator checks have been completed against the correct environment.

No acceptance is claimed by this template. It is an evidence capture template only.

---

## Required preconditions

- [ ] `pnpm staging:static-preflight` passed.
- [ ] Client has either approved current wording/placeholders or provided replacement copy.
- [ ] `docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md` has been updated from real client input.
- [ ] No migrations have been applied.

---

## Manual acceptance checklist

- [ ] Landing page loads on desktop.
- [ ] Landing page loads on mobile.
- [ ] Hero headline/subheading matches approved copy or approved placeholder.
- [ ] Pricing shows £80/month with no minimum commitment.
- [ ] Pricing shows £800/year annual option.
- [ ] Monthly Pro checkout CTA is visible and routes correctly.
- [ ] Annual Pro checkout CTA is visible or intentionally documented.
- [ ] Support/pay-it-forward path is visible.
- [ ] No public VIP/exhibitor/old portal language is visible.
- [ ] No WordPress/FluentCRM/FluentCommunity branding is visible.
- [ ] FAQ/contact/support copy matches approved copy or approved placeholder.
- [ ] Representative course/programme copy matches approved copy or approved placeholder.
- [ ] No migration/full-cutover claims are shown publicly.

---

## Evidence fields

| Field | Evidence |
| --- | --- |
| Operator name |  |
| Date/time |  |
| Environment |  |
| Deployed commit |  |
| URL checked |  |
| Desktop result |  |
| Mobile result |  |
| CTA result |  |
| Copy/content result |  |
| Blockers |  |
| Screenshots or evidence references |  |
| Final recommendation |  |

---

## Hard stops

- Do not mark accepted without real manual checks.
- Do not include secrets, passwords, API keys, private keys, webhook secrets, raw environment values, or screenshots containing sensitive values.
- Do not apply migrations.
- Do not treat front-end acceptance as migration approval.
- Do not treat front-end acceptance as full platform cutover.
- Do not claim provider/email verification or staging smoke is complete unless separate evidence exists.
