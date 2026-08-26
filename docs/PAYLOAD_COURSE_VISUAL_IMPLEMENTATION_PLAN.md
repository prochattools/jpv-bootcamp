# Payload Course Visual Implementation Plan

This plan aligns the course, access, and community work with the Version 3.3 Free/Pro model.

## Target Model

- Free is controlled non-paid access for support, pay-it-forward, staff, test, admin-created, or approved migration outcomes.
- Pro is the only paid subscription.
- Pro checkout has monthly and annual billing options.
- Support and pay-it-forward grant controlled Free access and are not separate tiers.

## First Core Go-Live

The first launch candidate must include:

- public landing page and registration copy using Free/Pro labels only;
- Pro checkout and billing portal handoff;
- secure member portal account flows;
- representative 8-week course structure with preview, locked, and available states;
- Payload course, module, lesson, media, and access policy administration;
- community/private-room preview behavior sufficient for client acceptance;
- partner first-release tracking for links, forms, sessions, and reports;
- support and pay-it-forward application, approval, claim, and notification flow;
- migration rehearsal that maps historical access into Free, Pro, expired, revoked, suspended, or review states;
- rollback notes and go-live approval checklist.

## Course Content

Create one representative 8-week course with:

- weekly modules;
- lessons with title, summary, body, media, and sort order;
- at least one public preview lesson;
- Free-access material where approved;
- Pro-only lessons behind active billing;
- admin-only draft and scheduled states.

The course must prove the real authoring and access workflow, not just static UI.

## Access Behavior

Access checks must fail closed:

- public preview is visible without sign-in;
- Free access is controlled by explicit entitlement or administrator action;
- Pro access requires an active or trialing Pro subscription;
- revoked, expired, suspended, unpaid, canceled, incomplete, or past-due states lose private access until recovered or reviewed.

## Community Preview

The launch preview should include enough behavior for acceptance:

- member-visible spaces;
- Pro/private-room visibility checks;
- posts or discussion placeholders managed through Payload;
- admin moderation or visibility controls.

Private messaging, rich notifications, live calls, and advanced room automation are post-core unless explicitly approved for launch.

## Storage And Media

Acceptance requires:

- course media upload;
- private media access checks;
- image/file rendering in the portal;
- documented limits for file size, storage provider, and rollback.

## Migration Rehearsal

Before launch, run a rehearsal using representative historical data:

- map controlled non-paid cases to Free;
- map paid active subscriptions to Pro;
- map lapsed or disputed cases to expired, revoked, suspended, or review;
- preserve audit notes for manual review;
- verify no removed product label is emitted as a target access state.

## Rollback

Rollback must cover:

- disabling public checkout entry points;
- pausing webhook projection if needed;
- restoring previous public copy;
- preserving Stripe event idempotency and audit logs;
- communicating any manual access corrections.

## Post-Core

Keep these outside first core go-live unless promoted by explicit approval:

- private messaging;
- advanced notification rules;
- live video calls;
- payout automation;
- partner payout webhooks;
- complex community automation.
