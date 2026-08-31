# Member access and engagement fixes — 31 August 2026

## Scope

This release fixes member course access, billing status parity, community
interaction capability, navigation contrast, and account layout. It does not
change database schema or rewrite existing member, billing, reaction, or
bookmark rows.

## Entitlement precedence

Stripe remains authoritative for commercial subscription state. Payload remains
the application and entitlement projection. When a member has no local Payload
subscription or has an unreconciled local billing account, the portal now
consults the linked operational customer record and Stripe subscription state.

The fallback is deliberately narrow:

1. An explicit Payload subscription state, including pending or terminal states,
   remains authoritative and continues to fail closed.
2. Only a missing or unreconciled Payload billing projection can use the
   operational fallback.
3. A linked, confirmed active or trialing subscription unlocks private course,
   lesson, and community access for an active verified member.
4. Missing, ambiguous, blocked, canceled, paused, or otherwise terminal state
   is not converted into access from the member account flag alone.

This keeps a paying member usable while a projection catches up without
granting private or secret content to an account with no confirmed entitlement.

## Community ownership and interaction

- Active members, moderators, and admins can post and reply where their active
  space membership permits it.
- Reactions are member-owned and can be changed or toggled off by that member.
- Bookmarks are member-owned and can be toggled off by that member.
- Members can edit or delete their own posts and comments/replies only.
- Members cannot edit, delete, or moderate another member's content.
- A parent comment with replies remains protected from deletion so the thread
  relationship is not broken; its author can still edit it.

All mutation paths continue to derive the member identity from the authenticated
portal session and use server-side ownership checks.

## UI fixes

- Course and lesson breadcrumb, reply, previous-lesson, and next-lesson links
  now use the readable interactive brand token on the light canvas.
- The account Change password card spans the same content width as the other
  account sections.

## Verification

The change adds regression coverage for operational billing recovery and the
fail-closed explicit-pending path. The engagement schema and existing
member-owned mutation tests remain in use. No new migration is required.
