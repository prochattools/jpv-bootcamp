# Future Group Calls — LiveKit and PayloadCMS Research Plan

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

LiveKit provides the real-time media runtime. PayloadCMS remains the operational system of record and owns identity, authorization, group membership, call scheduling, moderation, attendance, audit, and token issuance.

PayloadCMS collections should store only durable operational records and safe presentation data. LiveKit API keys, participant tokens, raw webhook payloads, and private recording credentials must never be stored in public or member-readable fields.

### Runtime flow

1. An authorized administrator creates or schedules a group call in PayloadCMS.
2. The call record is linked to a community group and contains a server-generated room key.
3. A signed-in member opens the group call page.
4. The server verifies account state, group membership, call status, and role through PayloadCMS-backed authorization.
5. A backend-only endpoint creates a short-lived LiveKit JWT containing participant identity, room, and minimal grants.
6. The browser receives only the short-lived room connection credentials.
7. The React client renders `LiveKitRoom` with `VideoConference` or a deliberately customized equivalent.
8. LiveKit webhooks update safe room and participant lifecycle records in PayloadCMS after signature verification and idempotency checks.

## Suggested PayloadCMS model

### `payload_group_calls`

- title;
- slug;
- linked community group or space;
- status: draft, scheduled, live, ended, canceled;
- scheduled start/end;
- server-generated LiveKit room key;
- host and moderator relationships;
- member-facing description and agenda;
- recording policy flag, default false;
- attendance and lifecycle summary fields;
- created/updated audit relationships;
- timestamps.

### `payload_group_call_attendance`

- call relationship;
- member relationship;
- role;
- joinedAt;
- leftAt;
- connection outcome;
- moderation outcome if applicable;
- no token, secret, raw media, or private provider payload.

### Optional lifecycle events

Use an append-only operational event collection or the existing audit/event pattern for room started, participant joined, participant left, moderation action, room ended, recording requested, and provider failure.

## Security and privacy requirements

- Generate LiveKit access tokens only on the server; API secrets never reach the browser.
- Derive participant identity, room, group, and role from the authenticated member and stored PayloadCMS call record, never browser-supplied trusted values.
- Use least-privilege grants for join, publish, subscribe, screen share, moderation, and recording.
- Use short token lifetimes and reject blocked, suspended, deleted, or unauthorized members.
- Treat private and secret group existence as confidential and fail closed.
- Verify webhook signatures and process events idempotently.
- Do not persist participant tokens, media keys, chat content, or raw webhook payloads in member-visible records.
- Remote unmute remains disabled by default because it can surprise participants.
- End-to-end encryption is a later decision requiring key distribution and recovery design; it is not implied by standard transport encryption.
- Recording and Egress require explicit consent, retention, storage, deletion, access, and regional compliance decisions. Self-hosted Egress is a separate service.

## PayloadCMS administration principles

PayloadCMS should provide the administrator workflow for scheduling calls, assigning hosts/moderators, linking calls to community groups, reviewing attendance, and inspecting safe lifecycle/audit events.

Administrator fields and access rules must ensure:

- ordinary members cannot create or alter call records;
- group moderators can receive only explicitly granted operational permissions;
- secrets and provider credentials are environment-only;
- room keys are server-generated and not trusted from member input;
- attendance and moderation records are access-restricted;
- recording URLs, if added later, are protected and time-limited.

## Delivery phases

### Research and product definition

- validate group-call use cases, room sizes, host model, accessibility needs, recording policy, moderation, and support expectations;
- choose LiveKit Cloud versus self-hosting using cost, operations, regions, scaling, monitoring, and Egress needs;
- define exact PayloadCMS collections, access rules, hooks, audit events, and retention policy.

### Technical proof of concept

- one private test group;
- one PayloadCMS-managed call record;
- server-issued short-lived token;
- React `LiveKitRoom` and `VideoConference` UI;
- no recording;
- lifecycle webhook audit into PayloadCMS;
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
- retention and deletion policy;
- replay authorization;
- captions, transcripts, and accessibility review.

## Acceptance gates

- unauthorized members cannot discover or join private calls;
- token endpoint trusts only server-derived member, group, room, and role;
- tokens are short-lived and least privilege;
- room events are signature-verified and idempotent;
- no LiveKit secret or participant token is stored in PayloadCMS fields or exposed in logs;
- group calls work on representative desktop and mobile browsers;
- accessibility, privacy, support, rollback, monitoring, and cost limits are approved;
- recording remains disabled until separately approved.

## Deferred decisions

- LiveKit Cloud versus self-hosted deployment;
- maximum room size and concurrency;
- persistent chat versus existing community discussions;
- recording, livestreaming, captions, and transcripts;
- calendar integration and reminders;
- moderator escalation and incident retention.

## Research sources

Primary references reviewed in July 2026:

- LiveKit documentation: authentication, tokens and grants, React components, rooms and participants, webhooks, encryption, self-hosting benchmarks, and Egress.
- PayloadCMS documentation and repository conventions: collections, relationship fields, access controls, hooks, local API, custom admin components, jobs, audit/event patterns, and Next.js integration.
