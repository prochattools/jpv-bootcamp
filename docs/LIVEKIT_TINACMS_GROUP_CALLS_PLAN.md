# Future Group Calls — LiveKit and TinaCMS Research Plan

## Status

**Future roadmap feature — research and architecture defined; implementation intentionally deferred.**

This document defines a future group-call capability for JPV Bootcamp community groups. It does not authorize implementation, deployment, provider procurement, recording, migration, or production rollout.

## Use case

Authorized JPV Bootcamp community groups may schedule and join live audio/video calls from their group space. Typical uses include cohort calls, coaching sessions, office hours, partner sessions, and administrator-led announcements.

The initial product boundary should support:

- one scheduled call linked to one authorized community group;
- member join/leave from the existing authenticated portal;
- host, moderator, speaker, and attendee permissions;
- camera, microphone, screen sharing, participant list, and basic non-persistent chat;
- room lifecycle and attendance audit;
- optional recording only after a separate privacy, retention, storage, and consent decision.

## Recommended architecture

LiveKit should provide the real-time media runtime. The JPV application remains responsible for identity, authorization, group membership, scheduling, audit, and token issuance.

TinaCMS should be limited to editable presentation and schedule configuration, such as call title, description, agenda, host label, start/end time, call-to-action copy, and optional reusable call-page content. TinaCMS must not issue LiveKit tokens, determine membership, store secrets, or act as the participant authority.

The current JPV repository uses Payload CMS as its operational system of record. Therefore, any future TinaCMS use should remain optional and content-only. Payload/member authorization must remain authoritative unless a separately approved CMS migration changes that boundary.

### Runtime flow

1. An administrator creates or schedules a group call through an authorized operational workflow.
2. The record is linked to a community group and contains a server-generated room key.
3. A signed-in member opens the group call page.
4. The server verifies account state, group membership, call status, and role.
5. A backend-only endpoint creates a short-lived LiveKit JWT containing participant identity, room, and minimal grants.
6. The browser receives only the short-lived room connection credentials.
7. The React client renders `LiveKitRoom` with the ready-made `VideoConference` component or a deliberately customized equivalent.
8. LiveKit webhooks update safe room/participant lifecycle records after signature verification and idempotency checks.

## Security and privacy requirements

- Generate LiveKit access tokens only on the server; API secrets never reach the browser.
- Derive participant identity and room from the authenticated member and stored call record, never browser-supplied trusted values.
- Use least-privilege grants for join, publish, subscribe, screen share, moderation, and recording.
- Use short token lifetimes and reject blocked, suspended, deleted, or unauthorized members.
- Treat private/secret group existence as confidential and fail closed.
- Verify webhook signatures and process events idempotently.
- Do not persist LiveKit tokens, media keys, chat content, or raw webhook payloads in CMS content.
- Remote unmute should remain disabled by default because it can surprise participants.
- End-to-end encryption is a later decision requiring key distribution and recovery design; it is not implied by standard transport encryption.
- Recording/egress requires explicit consent, retention, storage, deletion, access, and regional compliance decisions. Self-hosted egress is a separate service.

## TinaCMS integration principles

TinaCMS is Git-backed content tooling and supports React custom field components and Next.js visual editing. Use it only for deterministic content configuration. A custom field may preview call-page settings, but it must not open privileged rooms or generate runtime credentials inside the editor.

Recommended content model if TinaCMS is adopted later:

- `callTemplate`: title, description, agenda, help text, visual theme;
- `callPage`: slug, template reference, start/end display values, host display name, optional replay copy;
- no member IDs, group membership, LiveKit room secrets, tokens, webhook endpoints, provider credentials, or recording URLs.

Runtime call records, memberships, attendance, moderation state, and audit remain in Payload or another approved operational database.

## Delivery phases

### Research and product definition

- validate group-call use cases, expected room sizes, host model, accessibility needs, recording policy, moderation, and support expectations;
- choose LiveKit Cloud versus self-hosting using cost, operations, regions, scaling, monitoring, and egress needs;
- decide whether TinaCMS is actually required or whether Payload-managed presentation content is sufficient.

### Technical proof of concept

- one private test group;
- server-issued short-lived token;
- React `LiveKitRoom` and `VideoConference` UI;
- no recording;
- lifecycle webhook audit;
- database-free authorization tests plus controlled preview acceptance.

### Moderation and operations

- host/moderator roles;
- remove/mute permissions with clear participant UX;
- attendance summary;
- support diagnostics and connection-quality visibility;
- rate and concurrency limits.

### Recording and replay — optional later phase

- explicit consent;
- Egress recording and storage design;
- retention/deletion policy;
- replay authorization;
- captions/transcripts and accessibility review.

## Acceptance gates

- unauthorized members cannot discover or join private calls;
- token endpoint trusts only server-derived member, group, room, and role;
- tokens are short-lived and least privilege;
- room events are signature-verified and idempotent;
- no secrets or participant tokens are stored in TinaCMS or exposed in logs;
- group calls work on representative desktop and mobile browsers;
- accessibility, privacy, support, rollback, monitoring, and cost limits are approved;
- recording remains disabled until separately approved.

## Deferred decisions

- LiveKit Cloud versus self-hosted deployment;
- maximum room size and concurrency;
- persistent chat versus existing community discussions;
- recording, livestreaming, captions, and transcripts;
- TinaCMS adoption versus keeping all editable call content in Payload;
- calendar integration and reminders;
- moderator escalation and incident retention.

## Research sources

Primary references reviewed in July 2026:

- LiveKit documentation: authentication, tokens and grants, React components, rooms/participants, webhooks, encryption, self-hosting benchmarks, and Egress.
- TinaCMS documentation: Git-backed content architecture, Next.js App Router, visual editing, deterministic configuration, content modeling, custom React field components, and self-hosted authentication.
