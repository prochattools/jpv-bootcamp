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

1. Confirmed terminal Payload subscription states remain authoritative and
   continue to fail closed.
2. A missing or unreconciled Payload billing projection, including the stale
   `pending`/unrecognized status emitted during checkout projection lag, can
   use the operational fallback.
3. A linked, confirmed active or trialing subscription unlocks private course,
   lesson, and community access for an active verified member.
4. Missing, ambiguous, blocked, canceled, paused, or otherwise terminal state
   is not converted into access from the member account flag alone.

This keeps a paying member usable while a projection catches up without
granting private or secret content to an account with no confirmed entitlement.

## Follow-up production repair

The follow-up repair removes the legacy `payload_course_enrollments` gate from
lesson video playback. Bunny playback now calls the same lesson entitlement
service used by the lesson page, so a confirmed active member is not blocked by
an absent legacy enrollment row. The JSON community reply route now receives
the same operational billing fallback as reactions and bookmarks.

Community dashboard and post reads also reuse request-local entitlement and
operational billing promises. Community file projections are resolved with a
bounded concurrency limit instead of serially walking the full file set. These
changes are read-path and authorization-path changes only; they do not rewrite
member, billing, enrollment, reaction, bookmark, comment, or notification data
and do not add a database migration.

## Community ownership and interaction

- Active verified members can post and reply in spaces they are authorized to
  access; explicit space memberships and role checks remain available for
  moderation and targeted grants.
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

The change adds regression coverage for operational billing recovery, stale
pending projection recovery, central lesson video entitlement, request-local
deduplication, and the reply-route fallback. The engagement schema and existing
member-owned mutation tests remain in use. No new migration is required.
