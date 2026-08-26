# M0-05 — Stripe 12-Month Commitment Decision

- **Status:** Approved
- **Approved by:** Authorized JPV Bootcamp business owner
- **Approval date:** 10 July 2026
- **Implementation packet:** M0-06
- **Commercial offer:** Pro monthly at £80 for an initial 12-month commitment; Pro annual at £880 upfront
- **Jurisdictional baseline:** UK consumer subscription and distance-selling requirements

## Decision summary

JPV Bootcamp will use **Model A: a fixed-term Stripe Subscription Schedule** for the £80 monthly Pro option.

The schedule will represent an initial phase lasting **12 calendar monthly billing periods**. At the end of that phase, Stripe will **release** the underlying subscription so it continues as an ordinary £80 month-to-month subscription until the customer cancels.

The initial commitment is a minimum contractual amount of **£960**, collected as 12 monthly payments of £80. Failed or late payments do not extend the commitment end date. Statutory cancellation rights and approved early-termination exceptions override the ordinary end-of-term cancellation rule.

## Rejected alternatives

### Model B — Ordinary monthly subscription with a contractual minimum term

Rejected because Stripe would not enforce the term. Cancellation, debt collection, and outstanding-payment enforcement would depend on manual operational and legal processes, creating a mismatch between provider state and the advertised contract.

### Model C — Annual financial obligation financed through instalments

Rejected because treating the £960 obligation as financed credit may introduce additional accounting, consumer-credit, disclosure, collection, and regulatory complexity that is disproportionate to the product.

### Model D — Cancel-any-time monthly subscription

Rejected because it contradicts the approved commercial offer of £80 per month with an initial 12-month commitment.

## Approved decisions

### 1. Enforcement model

**Approved:** Model A — fixed-term Stripe Subscription Schedule.

The schedule is created for the monthly Pro purchase and contains an initial phase of 12 monthly billing periods. Its end behavior is `release`, leaving the underlying subscription active after the initial phase.

### 2. Commitment measurement

**Approved:** 12 calendar monthly billing periods.

The commitment is not measured as 12 successful payments and is not extended by retries, failed payments, account suspension, or delayed collection. Unpaid invoices remain payable under the contract, but the commitment end date remains fixed.

### 3. Commitment start

**Approved:** The commitment begins at the billing-cycle anchor associated with the first successfully paid subscription invoice.

Membership activation occurs only after a verified `invoice.paid` webhook confirms the initial invoice is paid and the subscription is active. The stored commitment start must match the Stripe schedule phase start and subscription billing anchor.

### 4. Early cancellation requests

**Approved:** Customers may request cancellation at any time.

- During an applicable statutory cooling-off period, cancellation takes effect immediately under the approved refund rule.
- Outside statutory rights or an approved exception, cancellation is scheduled for the end of the initial 12-period commitment.
- After the initial commitment, customers may cancel online with effect at the end of the current monthly billing period.

### 5. Billing and access after an early request

**Approved:** An ordinary early cancellation request does not stop billing or access immediately.

Billing continues through the initial commitment. Access remains active while invoices are paid and ends at the approved cancellation-effective date. A cancellation request alone must not place the member in a canceled or blocked entitlement state.

### 6. Behavior after period 12

**Approved:** The subscription continues month-to-month automatically.

The schedule releases the underlying subscription after the initial phase. No repurchase is required. The customer may then cancel at any time, effective at the end of the current monthly billing period.

### 7. Renewal price and interval

**Approved:** £80 per month after the initial commitment.

Any future price change requires at least 30 calendar days' advance notice and must not apply during the initial commitment without the customer's express agreement. The customer must be able to cancel before a post-commitment price change takes effect.

### 8. Administrator early termination

**Approved:** Early termination may be approved only for:

- Duplicate purchase or duplicate subscription
- Confirmed fraud or account compromise
- Legal or regulatory requirement
- Material service failure or prolonged inability to supply the purchased service
- Material mis-selling or incorrect contract disclosure
- Documented death, incapacity, or serious financial hardship
- Material breach by the customer, including abuse or unlawful activity

A Support Agent may collect the request but cannot approve it. Waiver of remaining payments, early termination, or a non-standard refund requires approval by both a **Billing Administrator** and the **Platform Owner**. Each decision must record the reason code, evidence reviewed, decision makers, timestamps, Stripe object IDs, refund decision, and resulting entitlement state.

A Billing Administrator may apply an immediate temporary security suspension for suspected fraud or abuse, but permanent termination must receive the second approval within one business day.

### 9. Refund policy

**Approved:**

1. For an online consumer purchase, the customer receives the applicable 14-day statutory cooling-off right beginning the day after the contract is made.
2. Checkout will separately capture the customer's express request for membership access to begin immediately.
3. If the customer cancels during the cooling-off period after requesting immediate access, JPV may deduct the proportionate daily value of service supplied before cancellation, only to the extent legally permitted and only where the required disclosure and consent were captured.
4. If immediate performance consent or required cancellation information was not captured correctly, issue the refund required by law without a service deduction.
5. Outside statutory rights, refunds are available only for duplicate or erroneous charges, material non-delivery or breach, confirmed mis-selling, or an approved hardship/early-termination exception.
6. Non-use of the membership alone does not create a contractual refund right.
7. Approved refunds must be returned to the original payment method without undue delay and no later than 14 calendar days after approval or cancellation where law requires that period.

Customer-facing legal wording must receive UK legal review before production launch.

### 10. Failed-payment and retry policy

**Approved:** Stripe automatic collection with a predictable custom retry schedule.

- Initial payment failure: notify the customer immediately and request payment-method correction or authentication.
- Retry 1: 3 calendar days after the initial failure.
- Retry 2: 7 calendar days after the initial failure.
- Retry 3: 14 calendar days after the initial failure.
- Notify the customer after the initial failure, before the final retry, after recovery, and when retries are exhausted.
- `invoice.payment_action_required` must trigger an immediate authentication notice.
- After the final failed retry, classify the account as unpaid, block Pro access, retain the outstanding invoice, and route the account for billing review.
- A successful recovery restores access automatically after verified `invoice.paid` processing.

### 11. Effect of failed payment on commitment length

**Approved:** Failed payment does not extend the commitment end date.

The calendar commitment continues while payment is overdue. Outstanding invoices remain due. An administrator may terminate the subscription under the approved exception process, but the application must not silently rewrite the commitment end date.

### 12. Access while past due or unpaid

**Approved:** Seven-calendar-day access grace period after the first failed renewal payment.

- `past_due`, days 0–7: access remains available with a prominent billing warning.
- After day 7 while still unpaid: block private Pro content and community access; retain access to billing and support surfaces.
- `unpaid` or provider-canceled: block private Pro access immediately.
- `invoice.paid`: restore access automatically if no separate account restriction exists.
- Fraud, abuse, or security incidents may be suspended immediately under the administrator policy.

### 13. Monthly-to-annual switching

**Approved:** No self-service monthly-to-annual switch during the initial commitment.

A customer may schedule the £880 annual option to begin when the initial monthly commitment ends. After the commitment, a monthly customer may switch to annual at the next monthly renewal boundary. No mid-period proration or credit is issued except to correct a billing error.

### 14. Annual-to-monthly switching

**Approved:** The change may take effect only when the paid annual access period ends.

No mid-term refund, proration, or credit is provided solely because the customer wants to change cadence. The requested monthly subscription begins at the next renewal boundary.

### 15. Proration, credits, discounts, coupons, and promotions

**Approved:**

- Automatic proration and discretionary account credits are disabled for commitment changes.
- Promotion codes are disabled for the standard monthly commitment checkout by default.
- A promotion requires written business approval defining eligibility, value, duration, redemption limits, and displayed total commitment amount.
- A discount must not shorten the 12-period commitment or obscure the undiscounted renewal price.
- One-time and temporary discounts must show both the discounted payments and the later £80 renewal amount before checkout.
- No setup, administration, or mandatory hidden fee may be added.
- The advertised £80 monthly and £880 annual prices are the total consumer prices, inclusive of applicable VAT, unless a future formally approved pricing decision replaces them.

### 16. Authoritative Stripe objects

**Approved hierarchy:**

1. **Subscription Schedule** — commitment phase start, phase end, schedule status, and transition after the initial term.
2. **Subscription** — current price, billing cadence, billing status, current period, cancellation status, and current access eligibility.
3. **Invoice and PaymentIntent** — payment success, failure, retry, authentication, amount due, and amount paid.
4. **Checkout Session** — initial purchase, customer acceptance version, selected cadence, and correlation metadata.
5. **Customer** — Stripe billing identity.

Application records are projections for entitlement, support, display, and audit. They must not override newer verified Stripe state.

### 17. Application mirror fields

**Approved fields:**

- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripeSubscriptionScheduleId`
- `stripePriceId`
- `stripeCheckoutSessionId`
- `billingCadence` (`monthly_commitment` or `annual`)
- `subscriptionStatus`
- `commitmentStatus` (`pending`, `active`, `cancellation_requested`, `completed`, `terminated`)
- `commitmentStartAt`
- `commitmentEndAt`
- `cancellationRequestedAt`
- `cancellationEffectiveAt`
- `paymentGraceEndsAt`
- `currentPeriodStart`
- `currentPeriodEnd`
- `lastPaidInvoiceId`
- `lastPaymentFailureAt`
- `contractVersion`
- `contractAcceptedAt`
- `immediateAccessConsentAt`
- `earlyTerminationReason`
- `earlyTerminationApprovedBy`

The number of remaining payments is derived for display and is not authoritative. M0-06 must add only the fields required by the approved implementation after verifying existing schema conventions.

### 18. Pre-checkout acknowledgment

**Approved wording and controls:**

The checkout page must show this summary immediately before the payment action:

> **Pro Monthly — £80 each month for an initial 12-month commitment. Total initial commitment: £960.** Your first payment is taken when checkout completes. After the initial 12 monthly billing periods, membership continues at £80 per month until you cancel. Outside statutory cancellation rights or an approved exception, a cancellation requested during the initial commitment takes effect when the commitment ends. Failed payments may suspend access.

Two unchecked checkboxes are required:

> **Contract acknowledgment:** I agree to pay £80 per month for the initial 12-month commitment, understand the total initial commitment is £960, and understand that membership continues monthly at £80 after the initial term until canceled.

> **Immediate access request:** I request immediate access to the membership during the 14-day cancellation period. I understand that if I cancel during that period, JPV may deduct the proportionate value of service supplied where legally permitted.

The payment button must clearly communicate an obligation to pay, for example: **“Start Pro — pay £80 now.”** Consent timestamps and the contract version must be stored durably.

### 19. Pricing wording

**Approved wording:**

> **Pro Monthly — £80/month for an initial 12-month commitment (£960 total).** After the initial term, continues monthly at £80 until canceled.
>
> **Pro Annual — £880 upfront for 12 months.** Any renewal terms must be shown before purchase.

The monthly price must never appear without the initial term and £960 total in the same pricing context.

### 20. Terms wording

**Approved commercial wording, subject to final UK legal review:**

> The Pro Monthly membership has an initial term of 12 calendar monthly billing periods at £80 per month, for a total initial commitment of £960. The commitment begins when the first subscription invoice is paid and membership is activated. You may request cancellation at any time. Unless a statutory cancellation right or approved early-termination exception applies, cancellation requested during the initial term takes effect at the end of that term, and scheduled payments remain due. After the initial term, membership continues at £80 per month and may be canceled at any time with effect at the end of the current billing period.
>
> If a payment fails, we will attempt collection under the published retry schedule. Access may be restricted after the approved grace period and restored after payment recovery. Failed payments do not extend the commitment end date.
>
> Statutory cancellation and refund rights are not limited by these terms. Where you expressly request immediate access during a statutory cancellation period, a legally permitted proportionate charge may apply for service supplied before cancellation.

### 21. Billing-portal wording and permitted actions

**Approved actions during the initial commitment:**

- View and download invoices
- Update billing details
- Update payment method
- View commitment start and end dates
- Submit an authenticated cancellation or hardship request

**Disabled during the initial commitment:**

- Immediate self-service cancellation
- Price or cadence switching
- Applying promotion codes
- Pausing the subscription
- Removing the payment method without replacement

**Approved portal wording:**

> Your Pro Monthly membership is within its initial 12-month commitment. You can update payment details and view invoices here. You may request cancellation at any time; unless statutory rights or an approved exception apply, cancellation takes effect on **[commitment end date]**. Plan changes during the initial commitment require support review.

After the commitment, online cancellation at period end and a scheduled switch to annual must be available without requiring a phone call.

### 22. Support and hardship procedure

**Approved process:**

1. Customer submits an authenticated portal request or another durable written request.
2. The system immediately acknowledges receipt and creates an auditable case reference.
3. A Support Agent verifies identity, categorizes the request, and requests only the evidence reasonably necessary.
4. Statutory cooling-off and duplicate-charge requests are prioritized and routed immediately.
5. Ordinary cancellation requests are recorded with the commitment-end effective date automatically.
6. Hardship or exceptional termination requests receive a decision within 10 business days.
7. A Billing Administrator and Platform Owner must approve any waiver, early termination, or non-standard refund.
8. Billing continues during review unless statutory rights, fraud controls, or an approved temporary hold require otherwise.
9. The decision, reasons, evidence, approvers, Stripe changes, refund, and entitlement outcome are recorded.
10. The customer receives the decision and effective date in a durable message.
11. Sensitive hardship evidence is access-restricted and retained only as long as operationally and legally required.

### 23. Required webhook behavior

**Approved event set:**

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed` if asynchronous payment methods are enabled
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `subscription_schedule.created`
- `subscription_schedule.updated`
- `subscription_schedule.expiring`
- `subscription_schedule.completed`
- `subscription_schedule.released`
- `subscription_schedule.canceled`
- `subscription_schedule.aborted`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

All webhook processing must:

- Verify Stripe signatures
- Be idempotent by Stripe event ID
- Tolerate duplicate and out-of-order delivery
- Retrieve authoritative Stripe objects when event order is ambiguous
- Record processed-event evidence
- Project provider state without trusting client metadata alone
- Apply entitlement transitions only after verified provider state
- Generate operational alerts for unhandled states or repeated failures

### 24. M0-06 acceptance criteria

**Approved:** M0-06 is complete only when all criteria below pass.

1. Monthly checkout creates the approved 12-period Subscription Schedule.
2. Schedule `end_behavior=release` produces the approved month-to-month continuation.
3. Annual checkout remains £880 upfront and does not create the monthly schedule.
4. Monthly pricing displays £80, 12 months, and £960 total together.
5. Both required checkout consents are explicit, unchecked, versioned, and stored.
6. Membership activates only after verified initial payment.
7. Commitment fields mirror verified Stripe schedule and subscription state.
8. Cancellation requests during the term record an effective end date without prematurely blocking access.
9. Statutory cooling-off cancellation and proportionate refund logic follow the approved policy.
10. The retry schedule is configured and projected consistently.
11. The seven-day payment grace and subsequent billing hold are deterministic.
12. Payment recovery restores access automatically.
13. Failed payment does not extend the commitment end date.
14. Billing portal restrictions and wording match the approved contract.
15. Monthly-to-annual and annual-to-monthly changes follow the approved boundary rules.
16. Promotion codes are disabled by default for the monthly commitment.
17. Duplicate checkout and duplicate active subscription protections remain enforced.
18. All approved schedule, subscription, invoice, refund, and dispute webhooks are signature-verified and idempotent.
19. Out-of-order and duplicate webhook tests pass.
20. Tests cover checkout pending, active commitment, payment grace, billing hold, cancellation requested, cooling-off cancellation, completion, release, monthly renewal, administrator termination, refund, and dispute.
21. `cancel_at_period_end` or an application cancellation request does not revoke access before the paid effective date.
22. Public pricing, checkout, terms, portal, email, and support copy are consistent.
23. Current UK legal review approves production customer-facing terms before launch.
24. Stripe test-mode validation uses Test Clocks and real test subscriptions to verify the full 12-period lifecycle, retries, completion, release, and cancellation behavior.
25. No production Stripe configuration, migration, or deployment occurs without separate authorization.

## State-transition contract

| State | Stripe authority | Application entitlement | Required transition |
|---|---|---|---|
| Checkout pending | Checkout Session, initial Invoice | No Pro access | Activate only after verified initial `invoice.paid` |
| Active and in commitment | Schedule + active Subscription | Pro access active | Continue monthly invoicing through the fixed phase |
| Payment grace | Open Invoice + `past_due` Subscription | Pro access with billing warning for seven days | Recover payment or enter billing hold |
| Billing hold | Open/unpaid Invoice + `past_due` or `unpaid` Subscription | Private Pro access blocked; billing/support retained | Restore after `invoice.paid` or terminate by policy |
| Cancellation requested | Application case + Schedule/Subscription | Access remains while paid | End at commitment boundary unless an exception applies |
| Cooling-off canceled | Refund/cancellation objects | Access ends at cancellation | Refund under approved statutory rule |
| Commitment completed | Completed schedule phase | Access remains | Release underlying subscription |
| Renewed month-to-month | Released active Subscription | Pro access active | Bill £80 monthly; online period-end cancellation allowed |
| Administrator terminated | Schedule/Subscription + audit case | Access revoked at approved effective time | Apply approved waiver/refund and record evidence |
| Refunded or disputed | Refund or dispute + Subscription | Subscription state remains primary; security hold allowed | Review and apply approved access/termination outcome |

## Implementation boundaries

M0-05 authorizes the contract definition only. M0-06 may implement the approved behavior but must not:

- Change production Stripe objects or portal settings without separate authorization
- Deploy or migrate production data automatically
- Replace Stripe as the provider source of truth
- Create a separate parallel commitment model
- Publish unreviewed legal wording

## External standards basis

This decision was aligned on 10 July 2026 with:

- Stripe Subscription Schedules documentation and API reference
- Stripe subscription webhook and payment-retry guidance
- Stripe Billing test-clock guidance
- UK Consumer Contracts Regulations distance-selling guidance
- Current UK unfair-commercial-practices guidance
- The announced UK subscription-contract regime expected to commence in Spring 2027

The approved commercial and operational decisions do not replace jurisdiction-specific legal advice. Final production terms require UK legal review under acceptance criterion 23.
