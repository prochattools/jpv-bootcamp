# Stripe Invoice Preview Rehearsal: JPV Bootcamp Membership Migration

This document describes the complete rehearsal harness for Stripe invoice preview testing, candidate classification, and entitlement reconciliation.

## Overview

The rehearsal system orchestrates:

1. **Candidate Inventory Building** — Load from fixtures or build programmatically with full Stripe context
2. **Classification** — Tier candidates as eligible/manual_review/ineligible with detailed blocking reasons
3. **Stripe Preview Requests** — Build and optionally execute read-only invoice previews (test mode)
4. **Reconciliation** — Verify credits, charges, tax, discounts, and billing anchors
5. **Webhook Projection** — Forecast expected payment and subscription events
6. **Reporting** — Generate auditable Markdown and JSON reports

## Architecture

### Files

- `src/lib/billing/membershipMigrationPreview.ts` — Core classification and prediction logic
- `src/lib/billing/candidateInventory.ts` — Helper API for building candidates
- `src/lib/billing/stripeInvoicePreviewRehearsal.ts` — Rehearsal orchestrator and reconciliation
- `src/lib/billing/stripeInvoicePreviewRehearsal.test.ts` — Fixture-based test
- `src/lib/billing/stripeInvoicePreviewRehearsal.e2e.test.ts` — Complete 7-scenario end-to-end test
- `src/lib/billing/stripeInvoicePreviewRehearsal.realistic.test.ts` — Realistic multiwave migration

### Key Types

#### MigrationCandidateInput
```typescript
type MigrationCandidateInput = {
  stableCandidateId: string          // unique, stable across runs
  memberId: string | null            // internal member ID (optional)
  normalizedEmail: string            // subscription contact email
  stripeCustomerProjection: {        // current Stripe customer
    customerId: string | null
    memberId: string | null
    normalizedEmail: string
  }
  stripeSubscriptionProjection: {    // current & target subscription details
    subscriptionId: string | null
    itemId: string | null
    currentProductId: string | null
    currentPriceId: string | null
    targetProductId: string | null
    targetPriceId: string | null
    currentCadence: 'monthly' | 'annual' | null
    targetCadence: 'monthly' | 'annual' | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    billingCycleAnchor: string | null
    cancelAtPeriodEnd: boolean | null
    status: string | null              // 'active', 'past_due', 'unpaid', etc.
    paymentStatus: string | null       // 'paid', 'failed', 'action_required'
    disputeStatus: string | null
    scheduleState: string | null       // non-null if subscription schedule active
    itemCount: number | null
    meteredState: boolean | null
    activeDiscountLabel: string | null
    activeDiscountAmount: number | null
    taxBehavior: string | null
    currentAmount: number | null       // in cents
    targetAmount: number | null        // in cents
    reconciliationState: MigrationReconciliationState | null
  }
  preview: MigrationPreviewEvidence | null  // result of live Stripe preview
}
```

#### ClassifiedMigrationCandidate
```typescript
type ClassifiedMigrationCandidate = MigrationCandidateInput & {
  targetCadence: MigrationCadence | null
  eligibility: 'eligible' | 'manual_review' | 'ineligible'
  reasons: MigrationBlockingReason[]  // why not eligible (empty if eligible)
  warnings: MigrationWarningCode[]    // non-blocking concerns
}
```

#### StripeInvoicePreviewRequest
```typescript
type StripeInvoicePreviewRequest = {
  customer: string
  subscription: string
  subscription_details: {
    proration_behavior: 'create_prorations'
    items: Array<{ id: string; price: string }>
  }
}
```

#### ReconciliationResult
```typescript
type ReconciliationResult = {
  candidate: ClassifiedMigrationCandidate
  preview: StripeInvoicePreviewResult | null
  errors: string[]
  reconciliation: {
    creditsMatched: boolean            // unused time credit matches expected
    chargesMatched: boolean            // remaining charge matches expected
    taxMatched: boolean                // tax matches expected
    amountDueMatched: boolean          // total due matches expected
    billingAnchorMatched: boolean      // billing anchor unchanged
    nextRenewalMatched: boolean        // next renewal date matches expected
    overallMatched: boolean            // all fields matched
    reconciliationState: 'matched' | 'mismatch' | 'failed'
    mismatches: string[]
  }
}
```

## Eligibility Classification

### Automatic Eligible (eligible=true, reasons=[])
A candidate is **eligible** if:
- Has valid customer ID
- Has valid subscription ID and item ID
- Has both current and target prices
- Current and target cadences are supported ('monthly', 'annual')
- Subscription status is 'active' or 'trialing'
- Payment status is 'paid'
- No dispute, no schedule, no scheduled cancellation
- Only one item on subscription
- Not metered billing
- **Optional:** preview evidence present and reconciled

### Manual Review (eligible=false, reasons=[...])
A candidate moves to **manual_review** if:
- Missing core identity (customer, subscription, item, prices, cadences) → **ineligible**
- OR has one or more of:
  - `past_due` subscription status
  - `unpaid` subscription status
  - `incomplete` / `incomplete_expired` subscription status
  - `paused` subscription status
  - Failed/action_required/disputed payment status
  - Active subscription schedule
  - Multiple subscription items
  - Metered billing
  - Preview evidence present but mismatched (tax, discount, renewal date, etc.)

### Ineligible (eligible=false, reasons=[...])
A candidate is **ineligible** if:
- Missing customer ID, subscription ID, item ID, current price, or target price

### Blocking Reasons (32 total)

#### Core Identity Missing
- `missing_customer` — No Stripe customer ID
- `missing_subscription` — No subscription ID
- `missing_item_id` — No subscription item ID
- `missing_current_price` — No current price ID
- `missing_target_price` — No target price ID
- `unsupported_cadence` — Cadence not 'monthly' or 'annual'

#### Subscription State
- `past_due` — Subscription is past due
- `unpaid` — Subscription is unpaid
- `incomplete` — Subscription setup not complete
- `paused` — Subscription is paused
- `disputed` — Payment dispute active
- `cancellation_pending` — Subscription marked for cancellation
- `schedule_present` — Active subscription schedule
- `multiple_items` — Multiple items on subscription
- `metered` — Metered billing active

#### Preview-Based Validation (requires preview evidence)
- `preview_missing` — No preview evidence present
- `price_mismatch` — Preview target price doesn't match candidate target
- `cadence_mismatch` — Preview cadence doesn't match candidate target
- `billing_anchor_mismatch` — Preview anchor doesn't match subscription anchor
- `next_renewal_mismatch` — Preview renewal doesn't match period end
- `discount_mismatch` — Preview discount doesn't match expected
- `tax_mismatch` — Preview tax doesn't match expected
- `zero_amount` — Preview shows $0 due (not same-price candidate)
- `net_credit` — Preview shows net credit (insufficient charge to cover unused time)
- `unexpected_negative_amount` — Preview shows negative amount with no credit reason
- `reconciliation_mismatch` — Preview reconciliation state doesn't match expected

## Candidate Inventory API

### Load from Fixture
```typescript
import { candidateInventory } from '@/lib/billing/candidateInventory'

const fixture = JSON.parse(fs.readFileSync('fixture.json'))
const candidates = candidateInventory.fromFixture(fixture)
```

Fixture format (minimal):
```json
[
  {
    "normalizedEmail": "student@example.com",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "stripePriceId": "price_xxx",
    "subscriptionStatus": "active",
    "subscriptionCurrentPeriodEnd": "2026-08-01T00:00:00.000Z",
    "subscriptionCancelAtPeriodEnd": false,
    "billingCadence": "monthly",
    "paymentStatus": "paid",
    "paymentDisputeStatus": null
  }
]
```

### Build Programmatically
```typescript
const candidate = candidateInventory.create({
  stableCandidateId: 'wave1_001',
  normalizedEmail: 'student@example.com',
  customerId: 'cus_live_1',
  subscriptionId: 'sub_live_1',
  itemId: 'si_live_1',
  currentPriceId: 'price_monthly_2024',
  targetPriceId: 'price_annual_2025',
  currentCadence: 'monthly',
  targetCadence: 'annual',
  currentPeriodStart: new Date('2026-06-15'),
  currentPeriodEnd: new Date('2026-07-15'),
  billingCycleAnchor: '15',
  status: 'active',
  paymentStatus: 'paid',
  itemCount: 1,
  currentAmount: 4999,   // $49.99
  targetAmount: 49900,   // $499.00
})
```

### Pre-built Scenarios
```typescript
// Eligible candidate with default values
const eligible = candidateInventory.asEligible(baseCandidate)

// Manual review candidate (past_due)
const review = candidateInventory.asManualReview(baseCandidate)

// Ineligible candidate (missing customer)
const ineligible = candidateInventory.asIneligible(baseCandidate)
```

## Classification Workflow

```typescript
import { classifyMigrationCandidate } from '@/lib/billing/membershipMigrationPreview'

const candidates: MigrationCandidateInput[] = [...]
const classified: ClassifiedMigrationCandidate[] = candidates.map(classifyMigrationCandidate)

const eligible = classified.filter(c => c.eligibility === 'eligible')
const review = classified.filter(c => c.eligibility === 'manual_review')
const ineligible = classified.filter(c => c.eligibility === 'ineligible')
```

## Building Stripe Preview Requests

For **eligible candidates only**:

```typescript
import { buildStripeInvoicePreviewRequest } from '@/lib/billing/membershipMigrationPreview'

const candidate: ClassifiedMigrationCandidate
const previewRequest = buildStripeInvoicePreviewRequest({
  candidate,
  subscriptionItemId: 'si_xxx',
  targetPriceId: 'price_xxx',
})

// In production, call Stripe:
// const invoice = await stripe.invoices.preview(previewRequest)
```

This creates a request that Stripe will process to show the expected invoice.

## Running the Rehearsal

### Phase 1: Build candidates
```bash
pnpm tsx src/lib/billing/stripeInvoicePreviewRehearsal.test.ts
```

Uses `docs/client/fixtures/MEMBERSHIP_MIGRATION_PREVIEW_FIXTURE.json`

### Phase 2: End-to-end scenarios
```bash
pnpm tsx src/lib/billing/stripeInvoicePreviewRehearsal.e2e.test.ts
```

Tests all 7 classification scenarios (eligible, manual review, ineligible).

### Phase 3: Realistic migration
```bash
pnpm tsx src/lib/billing/stripeInvoicePreviewRehearsal.realistic.test.ts
```

Simulates a realistic multi-wave migration with financial projections.

## Reconciliation Verification

For each eligible candidate, the rehearsal verifies:

1. **Credits Matched** — Unused time credit equals proration credit
2. **Charges Matched** — Remaining time charge equals upgrade cost
3. **Tax Matched** — Invoice tax equals expected tax on net amount
4. **Amount Due Matched** — Total due = subtotal - discount + tax
5. **Billing Anchor Matched** — Anchor unchanged in preview
6. **Next Renewal Matched** — Next renewal date matches period end
7. **Overall Matched** — All fields reconcile

If any mismatch is detected, reconciliation state = 'mismatch', and the candidate remains blocked until manual review.

## Webhook Projection

For each eligible candidate approved for migration, expect:

1. **subscription.updated** — Price change applied
2. **invoice.created** — Prorated invoice generated
3. **invoice.paid** — Payment captured (if invoice.amount_due > 0)
4. **invoice.payment_failed** — (only if payment fails)

Total expected webhooks: `eligible_count × 3` (assuming all payments succeed)

## Safety Boundaries

**During Rehearsal:**
- No Stripe API calls are made (uses test fixtures or in-memory simulation)
- No database mutations occur
- No production subscriptions are modified
- All classification is deterministic and auditable
- All reports are JSON and Markdown (human and machine readable)

**Before Live Migration:**
1. Classify all candidates (this rehearsal)
2. Manually review any 'manual_review' tier
3. Get explicit approval for eligible candidates
4. **Immediately before approval:** Run live Stripe invoice preview for each eligible
5. Verify preview matches rehearsal expectations
6. Approve the migration
7. Update subscriptions and monitor webhooks

**Never:**
- Auto-approve without live Stripe preview
- Skip manual review tier
- Modify multiple candidates in a single transaction
- Run against production subscriptions until rehearsal complete

## Reporting

### Generate Markdown Report
```typescript
import { buildMembershipMigrationPreviewMarkdown } from '@/lib/billing/membershipMigrationPreview'

const report = buildMembershipMigrationPreviewMarkdown(candidates)
console.log(report)
```

### Generate JSON Report
```typescript
import { buildMembershipMigrationPreviewJson } from '@/lib/billing/membershipMigrationPreview'

const json = buildMembershipMigrationPreviewJson(candidates)
fs.writeFileSync('report.json', json)
```

### Generate Rehearsal Report
```typescript
import { buildRehearseReportMarkdown } from '@/lib/billing/stripeInvoicePreviewRehearsal'

const { rehearsal, report } = await rehearseStripeInvoicePreviewsForCohort(eligible, {
  stripe,
  targetPriceId: 'price_xxx',
  subscriptionItemId: 'si_xxx',
})

const markdown = buildRehearseReportMarkdown({ rehearsal, report })
console.log(markdown)
```

## Example Output

See test outputs from:
- `src/lib/billing/stripeInvoicePreviewRehearsal.test.ts` — Fixture-based
- `src/lib/billing/stripeInvoicePreviewRehearsal.e2e.test.ts` — Scenario-based
- `src/lib/billing/stripeInvoicePreviewRehearsal.realistic.test.ts` — Migration projection

## Testing Integration

Rehearsal harness integrates with:
- `src/lib/membership-support/stripeAdapter.ts` — Interface for Stripe operations
- `src/lib/membership-support/stripeAdapter.test.ts` — In-memory test adapter
- `src/lib/provisioning.ts` — Entitlement provisioning after approval

## Next Steps

1. Run `pnpm tsx src/lib/billing/stripeInvoicePreviewRehearsal.realistic.test.ts` to see comprehensive output
2. Review classification for any unexpected ineligible candidates
3. Inspect manual review tier for payment issues or subscription anomalies
4. For production migration: get explicit approval + run live Stripe preview
5. Monitor webhook events and reconciliation after update
