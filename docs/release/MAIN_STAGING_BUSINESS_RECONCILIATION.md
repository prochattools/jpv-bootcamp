# Main / Feature Branch Business Reconciliation

**Branch:** `feature/course-branding-and-preview`
**Feature tip:** `c15cd578`
**Main tip:** `4995dcc3`
**Document date:** 2026-08-02

This document classifies every business-logic change present on `main` that is absent from the feature branch. No changes are automatically ported. Each item must be actioned before the feature branch can be landed or a cutover executed.

---

## Scope

Two files carry all main-only delta:

| File | Main-only commits |
|---|---|
| `src/app/(frontend)/page.tsx` | 9 commits (cca340a → 4995dcc) |
| `src/components/sponsored-pay-it-forward.tsx` | 1 commit (24045e6) |

---

## Classification Matrix

### 1. Auth / portal URLs — `page.tsx`

| Attribute | Main branch | Feature branch |
|---|---|---|
| `signInHref` | `https://portal.jpvbootcamp.com/community/?fcom_action=auth` | `/portal?mode=login` |
| `signUpHref` | `https://portal.jpvbootcamp.com/community?fcom_action=auth&form=register` | Not present (sign-up via `/upgrade` checkout flow) |

**Classification: REJECT AS OBSOLETE**

The feature branch routes all auth through the new internal `/portal` route backed by the tenant auth system built as part of this feature. The legacy external ForumWP community URLs are the system being replaced. Porting them would break the new auth architecture.

---

### 2. Pricing — monthly price point

| Attribute | Main branch | Feature branch |
|---|---|---|
| Monthly price displayed | £80/mo | £80/mo |

**Classification: ALREADY SUPERSEDED**

Both branches agree: £80/month. Main reached this via two commits (cca340a set £49, 08a5f0f corrected to £80). The feature branch was authored with £80 from the start. No action required.

---

### 3. Pricing — annual price point

| Attribute | Main branch | Feature branch |
|---|---|---|
| Annual price displayed | £800 annually | £800/year (paid upfront for 12 months) |
| Annual label | "2 months at no extra cost" + "1 clear annual payment" | "Two months included at no extra cost" + "One clear annual payment" |
| Annual CTA | "Available Soon" (disabled button) | "Choose annual membership" → `/upgrade` |
| Annual availability | Disabled/locked on main | Enabled with full checkout flow on feature branch |

**Classification: ALREADY SUPERSEDED**

The feature branch implements the correct final state: annual plan is active and routes through the new `/upgrade` checkout. Main's disabled annual button is a temporary workaround that predates the annual checkout implementation on this feature branch. No backport needed.

---

### 4. Stripe checkout endpoint — monthly CTA

| Attribute | Main branch | Feature branch |
|---|---|---|
| Monthly CTA href | `/api/stripe/checkout?plan=vip` | `/upgrade` (leads to `/api/stripe/checkout?plan=membership&billing=monthly`) |

**Classification: REJECT AS OBSOLETE — with flag**

Main's `plan=vip` checkout parameter is a legacy two-tier artefact. The feature branch's singular membership architecture uses `plan=membership&billing=monthly|annual`. The VIP Stripe price ID (`price_1TwKXkLQNsjxBhGBB48pVZa6`, present in an intermediate main commit 08a5f0f and then replaced by `plan=vip` in d7e93be) must NOT be carried forward — it belongs to a tier that no longer exists in the product.

**Flag for cutover operator:** Confirm that the live Stripe product named "VIP" has been decommissioned or migrated to the singular membership price before go-live. The feature branch checkout expects `plan=membership` to resolve to a valid Stripe price in the environment.

---

### 5. Pricing tier architecture — VIP vs singular membership

| Attribute | Main branch | Feature branch |
|---|---|---|
| Tier names | "Monthly" and "Annually" (relabelled from former Pro/VIP) | "Monthly" and "Annual" |
| Number of distinct products | Two Stripe products (vip for monthly CTA, annual locked) | One product, two billing intervals |
| Disabled annual | Yes — "Available Soon" | No — annual fully active |

**Classification: REJECT AS OBSOLETE**

Main still references `plan=vip` as the active checkout even though the plan was cosmetically renamed to "Monthly". This is an inconsistent state created during the refactor on main. The feature branch resolves this correctly with a singular `membership` product and billing-interval routing.

---

### 6. Hero notices — event dates and copy

| Attribute | Main branch | Feature branch |
|---|---|---|
| First notice title | "Next Live Online Bootcamp" | Not present as a discrete event notice card |
| First notice date | Friday, 11 September \| 7:00 PM (BST) | — |
| First notice bullets | 7 Weekly Live Online Training Sessions; 1 Full-Day In-Person Intensive; Available with All Membership Plans | — |
| Second notice title | "JV & Networking Summit" | Not present as a discrete event notice card |
| Second notice date | Saturday, 24 October \| All Day \| London | — |
| Second notice bullets | 5 bullets: Full-Day Live Event, JV Partnerships, Network, Acquisition Strategy, Action Planning | — |
| Previous notice (pre-main) | "Inheritance Builders Bootcamp Conference — 27 March 2026 · London" (removed in 24045e6) | Different section layout — no equivalent notice block |

**Classification: CLIENT DECISION REQUIRED**

The feature branch uses a redesigned hero section that does not include a hero-notice card pattern at all. The event dates on main (September 11 and October 24) may be current, past, or provisional. The client must confirm:

1. Are the September 11 and October 24 event dates confirmed and correct?
2. Should event notice cards be added to the feature branch hero, or are these events surfaced elsewhere (e.g., an events page, a calendar section)?
3. The feature branch removed the "Inheritance Builders Bootcamp Conference" link (`https://ibbootcamp.co.uk`) from main-prior state. Does the client want this external link preserved anywhere?

Do not silently inject the main hero notices into the feature branch layout — they depend on a `heroNotices` data structure and rendering pattern that does not exist in the feature branch JSX.

---

### 7. Hero notices — `bullets` field and rendering pattern (4995dcc)

| Attribute | Main branch | Feature branch |
|---|---|---|
| `heroNotices` type | Includes `bullets?: string[]` field | No `heroNotices` array |
| Rendering | Maps bullets with green checkmark icons | N/A |

**Classification: REJECT AS OBSOLETE**

This is a rendering refactor of the main-branch hero notice pattern (commit 4995dcc). Since the feature branch does not use this pattern, the change has no applicable target. Reject at the structural level.

---

### 8. Annually plan feature list wording

| Attribute | Main branch (after 24045e6) | Feature branch |
|---|---|---|
| Annual features | "Same features", "Paid upfront for 12 months", "2 months at no extra cost", "1 clear annual payment" | "Automatically renews annually unless cancelled", "Programme, resources, and community access", "Personal voucher and pay-it-forward codes supported", "One clear annual payment" |

**Classification: ALREADY SUPERSEDED**

The feature branch annual plan feature list is more complete and accurate for the new architecture (includes voucher/pay-it-forward support, correct renewal language). Main's list was a stub written before the annual checkout existed. The feature branch version supersedes it.

---

### 9. Sponsored pay-it-forward — tier architecture

| Attribute | Main branch | Feature branch |
|---|---|---|
| `SponsoredCounts` type | `{ pro: number, vip: number, proEnabled?: boolean, vipEnabled?: boolean }` | `{ available: number, enabled?: boolean }` |
| `handleCheckout` signature | `handleCheckout(tier: 'pro' \| 'vip')` — passes `tier` in POST body | `handleCheckout()` — no tier, empty POST body `{}` |
| Button label | "Sponsor a VIP month" | "Fund JPV Bootcamp Membership" |
| Disabled state | `disabled={loading}` — always clickable if not loading | `disabled={loading \|\| !counts.enabled}` — respects server-side enabled flag |
| Available count display | `counts.pro + counts.vip` | `counts.available` |
| API response shape expected | `{ pro, vip, proEnabled, vipEnabled }` | `{ available, enabled }` |

**Classification: REJECT AS OBSOLETE**

The main branch component reflects the legacy two-tier (Pro/VIP) sponsored seat model. The feature branch replaces this with a singular membership sponsored seat model. The backend API `/api/sponsored-seats/available` and `/api/sponsored-seats/checkout` must serve the feature branch shape (`{ available, enabled }` and a body-less POST respectively). Porting the main version would re-introduce the defunct tier split and would break against the new API contract.

**Flag for cutover operator:** Verify that the `/api/sponsored-seats/available` endpoint on the deployment target returns `{ available: number, enabled: boolean }`, not `{ pro, vip, ... }`. If the API was updated only on the feature branch, ensure it is deployed before the frontend goes live.

---

## Summary Table

| # | Change | File | Classification |
|---|---|---|---|
| 1 | Legacy ForumWP external portal URLs | `page.tsx` | REJECT AS OBSOLETE |
| 2 | Monthly price £80/mo | `page.tsx` | ALREADY SUPERSEDED |
| 3 | Annual price £800, annual plan enabled | `page.tsx` | ALREADY SUPERSEDED |
| 4 | Stripe CTA uses `plan=vip` for monthly | `page.tsx` | REJECT AS OBSOLETE |
| 5 | VIP tier vs singular membership architecture | `page.tsx` | REJECT AS OBSOLETE |
| 6 | Hero notices with Sep 11 / Oct 24 event dates | `page.tsx` | CLIENT DECISION REQUIRED |
| 7 | `bullets[]` field and hero notice rendering refactor | `page.tsx` | REJECT AS OBSOLETE |
| 8 | Annually plan feature list wording | `page.tsx` | ALREADY SUPERSEDED |
| 9 | Two-tier sponsored checkout (Pro/VIP) | `sponsored-pay-it-forward.tsx` | REJECT AS OBSOLETE |

---

## Open Items Before Cutover

### CLIENT DECISION REQUIRED

- [ ] **Hero event notices** — confirm September 11 Bootcamp date and October 24 Summit date. Decide whether to add event notice cards to the feature branch hero or surface events in a separate location. Confirm whether the Inheritance Builders Bootcamp Conference (`ibbootcamp.co.uk`) link should appear anywhere.

### Operator verification (not a client decision, but must be confirmed)

- [ ] **Stripe VIP product** — confirm the legacy "VIP" Stripe product/price is decommissioned or migrated before go-live. The feature branch checkout does not reference `plan=vip`.
- [ ] **Sponsored-seats API shape** — confirm the deployed API endpoint returns `{ available, enabled }` not the legacy `{ pro, vip, proEnabled, vipEnabled }` shape.

---

*Generated from commit diff between `4995dcc` (main) and `c15cd57` (feature/course-branding-and-preview). No code was modified by this document.*
