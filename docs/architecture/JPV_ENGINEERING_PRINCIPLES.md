# JPV Bootcamp Engineering Principles

**Status:** CURRENT A5.1 ENGINEERING AUTHORITY — APPLIES TO A5.1–A6

**Date:** 2026-08-27

These principles constrain behavior-preserving consolidation of the production
system. A1 through A5.1 are complete locally on the dedicated consolidation
branch; A6 remains separately gated. A packet may narrow these
rules with evidence, but may not silently contradict them.

## Approved packet sequence

The architecture packets are fixed in this order:

1. A0 — Production truth and architecture authority
2. A1 — Authorization/service foundation
3. A2 — Shared domain primitives
4. A3 — Community domain convergence
5. A4 — Course/Creator domain convergence
6. A5 — Source-of-truth and architecture enforcement
7. A6 — Full regression and controlled production integration

A6 is the exact next packet. No controlled production integration is implied by
this document or by A5.

## A2 shared primitive authority

- `src/lib/domain/validation.ts` is the canonical source for slug, title,
  bounded-text, and scalar record-ID normalization. New transport adapters must
  reuse it rather than introduce local copies.
- `src/lib/domain/relationships.ts` is the canonical source for extracting
  direct or populated Payload relationship IDs and normalizing write values.
- `src/lib/content/plainTextToLexical.ts` is the canonical source for
  deterministic plain-text Payload Lexical state. Compatibility exports may
  delegate to it, but equivalent serializers must not diverge.
- The full current administrator boundary inventory is maintained in
  `JPV_PORTAL_ADMIN_SERVICE_MAP.md`. A service-map row is documentation of the
  current boundary, not permission to widen a packet or move ownership.

## A1 implementation authority

- Every portal Creator/Admin Server Action enters through the server-only
  `requirePortalAdmin()` gate, which builds on `requirePortalAccess()` and
  rejects a member actor regardless of client AdminGate or Admin Mode state.
- These actions return the shared `PortalAdminActionResult<T>` contract. Known
  validation, not-found, conflict, dependency, authentication, authorization,
  and rate-limit failures use bounded codes; unexpected failures are logged
  without exposing internal exception text and return `internal_error`.
- Exceptional privileged Payload operations use the bounded
  `privilegedPayloadAccess()` helper only after administrator authorization and
  with an explicit reason. Native Payload access remains preferred where it
  can express the operation cleanly.
- Server Action boundaries are transport adapters: receive transport input,
  establish the actor, call the existing domain operation, translate to the
  shared result, and perform only targeted cache revalidation or redirect
  behavior. Long-term domain policy, relationship rules, destructive
  orchestration, and cross-store persistence remain later packet work.

## Non-negotiable rules

1. **Business rules belong in domain services, not pages/components.** A page
   may select and present a capability; it must not become the business-rule
   owner.
2. **Server Actions are transport adapters, not business layers.** They parse
   transport input, establish the actor/context, call a domain operation, and
   return a safe result.
3. **React pages orchestrate UI and queries only.** Reads, loading states,
   mutation feedback, and composition belong at the boundary; persistence and
   policy do not.
4. **Security cannot depend on visual gates.** Hidden controls, badges, or
   Creator Mode state never replace server-side authentication, authorization,
   entitlement, and actor checks.
5. **`AdminGate` / Creator Mode controls presentation only.** It may expose
   administrator affordances, but the server must enforce every mutation and
   must not use the gate as an authorization source.
6. **Member/admin mutations share domain operations with actor policy.** The
   operation should be reused where semantics are shared; the actor policy
   determines what the member, administrator, or system actor may do.
7. **`overrideAccess: true` is exceptional privileged infrastructure.** Every
   use requires a named reason, trusted server boundary, narrow query, and
   audit/verification story where it changes business state.
8. **Prefer Payload native access where practical.** Payload access rules and
   hooks remain the first choice for Payload-owned collections; service-level
   policy is added where a workflow spans records or providers.
9. **Prisma and Payload ownership must never be casually crossed.** A query in
   one datastore is not a license to write the other. Cross-store workflows
   need explicit ownership, ordering, idempotency, and failure handling.
10. **Stripe is provider truth.** Local billing state is a documented
    projection/operational record and must not be treated as a replacement for
    Stripe’s customer, subscription, invoice, or payment state.
11. **Do not create duplicate serializers, validators, or policies.** Reuse a
    canonical domain contract; if two contracts differ, document the reason
    and migrate deliberately rather than cloning logic.
12. **Archive before destructive deletion where business data is dependent.**
    Deletion must respect retention, audit, provider cleanup, relationship
    dependencies, and reversible recovery where the domain requires it.
13. **Administrator mutations are auditable.** Record actor, target, intent,
    before/after or result, provider request identity where applicable, and
    failure/retry state without storing secrets.
14. **No giant Server Action god-files.** Keep transport entry points small;
    organize domain services by bounded capability and keep dependencies
    directional.
15. **No new design/token authority.** Use the JPV Design System Authority and
    `src/lib/brand/jpvDesignSystem.ts`; page-local palettes and competing token
    maps are prohibited.
16. **No arbitrary page-local API/data architecture.** New reads and writes
    must fit the documented route, service, actor-policy, cache, and source of
    truth boundaries.
17. **`main` must remain releasable.** Work is isolated on a dedicated packet
    branch, validated in proportion to risk, and merged only with a reversible
    release record and independently verified production evidence.
18. **Source-of-truth boundaries are explicit.** Stripe owns commercial
    customer, subscription, invoice, and payment facts; Payload owns members,
    courses, community, access, and progress; local records are projections,
    operational ledgers, or audit rows unless a document names them otherwise.
19. **Stable identity precedes fallback identity.** Reconciliation matches
    provider/customer IDs first and normalized email only when unique. Unknown,
    duplicate, stale, or wrong-environment joins fail closed into review.
20. **Dry-run means mechanically write-incapable.** A dry-run may read and
    return a report, but it must not invoke callbacks or hooks that can persist
    checkpoints, audit rows, provider state, or communications.
21. **Privileged access is registered.** Every exceptional Payload override,
    direct Prisma import, and server-only browser boundary is inventoried in
    `JPV_PRIVILEGED_ACCESS_REGISTER.md` and enforced by the architecture guard.
22. **Pages and components do not own persistence.** Route/page exceptions are
    named legacy residue; new persistence belongs behind a domain service with
    actor policy, idempotency, audit, and failure recovery.
23. **One design-token authority.** `src/lib/brand/jpvDesignSystem.ts` owns
    JPV tokens; registered portal theme and Payload mapping files may consume or
    override presentation variables but may not create a competing palette.

## Review questions for every packet

- Which domain fact is being changed, and which datastore/provider owns it?
- Which actor is allowed to initiate, approve, retry, or reverse the action?
- Which existing domain operation and policy are reused?
- What happens when the provider, local projection, email, or cache fails?
- What is the audit record and idempotency key?
- Can the change be rolled back without guessing or deleting unrelated data?
- Which exact validation proves that behavior, security, and UX contracts are
  preserved?
