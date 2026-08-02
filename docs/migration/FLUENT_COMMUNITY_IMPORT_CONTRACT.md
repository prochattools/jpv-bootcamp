# Fluent Community Import Contract

**Repo:** jpv-bootcamp
**Status:** IMPORT ADAPTER NOT IMPLEMENTED — DISCOVERY EXPORT REQUIRED BEFORE DESIGN CAN ADVANCE
**Last updated:** 2026-08-02

---

## Overview

This document is a design contract for a future Fluent Community import adapter. No concrete parser has been written. No field names have been assumed without basis. The contract cannot advance to implementation until the operator provides a complete discovery export from the live Fluent Community instance.

---

## 1. Discovery Gap

The following facts are not yet known and cannot be safely assumed:

- **Export format.** Fluent Community does not publish a documented bulk-export schema. Whether the export is JSON, CSV, WXR-derived, or WordPress database dump is unknown.
- **API availability.** Whether the live instance exposes a REST or WP-REST API surface that permits bulk data extraction is unknown. If it does, the authentication mechanism, pagination strategy, and rate limits are unknown.
- **Field names.** The exact column and property names for users, spaces, memberships, posts, comments, reactions, and attachments are unknown. The names used in Section 5 (adapter interfaces) are placeholders derived from the generic Fluent Community UI vocabulary; they must be validated against a real export before any parser is written.
- **Privacy structure.** How Fluent Community encodes space visibility, join-approval gates, and post-approval gates in its data layer is unknown.
- **Moderation state.** Whether soft-deleted posts, suspended users, and banned memberships are included in an export, and what field signals each state, is unknown.
- **Reaction schema.** Whether reactions are stored per-object or in a centralized event log, and whether they are included in any standard export, is unknown.
- **Attachment storage.** Whether media files are referenced by URL, stored in the WordPress uploads directory, or offloaded to a CDN is unknown. The URL structure and accessibility of attachment files is unknown.
- **Timestamp encoding.** Whether all timestamps are UTC ISO-8601, WordPress local-time strings, or Unix integers is unknown.
- **User identity link.** Whether Fluent Community stores its own user IDs separately from WordPress `wp_user_id` values, and whether both are present in an export, is unknown.

No adapter can be written safely until these facts are established by reviewing an actual export.

---

## 2. Required Discovery Export Specification

The operator must obtain the following artifacts from the live Fluent Community instance before adapter design can advance. Each artifact must be accompanied by a row count and a SHA-256 checksum recorded in `migration-inventory.json`.

### 2.1 Users and Source IDs

A complete user roster linking Fluent Community identities to WordPress user IDs.

Required fields (exact names to be confirmed against actual export):
- Fluent Community user identifier
- WordPress `wp_user_id` (integer)
- Email address
- Display name
- Account join date
- Account status (active, suspended, deleted, or equivalent)

### 2.2 Spaces and Groups

All community spaces and group definitions.

Required fields:
- Space identifier
- Name and slug
- Space type or category (discussion, announcement, course cohort, or equivalent)
- Privacy or visibility level
- Owner user identifier
- Creation and last-updated timestamps
- Status (active, archived, deleted, or equivalent)

### 2.3 Memberships and Roles

All user-to-space membership records.

Required fields:
- User identifier
- Space identifier
- Role within the space (member, moderator, admin, or equivalent)
- Membership status (active, pending, banned, removed, or equivalent)
- Join timestamp
- Any ban or removal timestamp and reason

### 2.4 Posts

All community posts in all spaces.

Required fields:
- Post identifier
- Space identifier
- Author user identifier
- Post type (discussion, question, announcement, or equivalent)
- Content (raw HTML, Markdown, or serialized block format — format must be identified)
- Publication status (published, pending, hidden, deleted, or equivalent)
- Creation and last-updated timestamps
- Whether the post is pinned or locked

### 2.5 Comments and Replies

All comments and threaded replies on posts.

Required fields:
- Comment identifier
- Parent post identifier
- Parent comment identifier (for nested replies; null for top-level comments)
- Author user identifier
- Content (format must match posts format)
- Moderation status
- Creation and last-updated timestamps

### 2.6 Reactions

Required only if reactions must be preserved. If reactions are out of scope, document the explicit decision.

Required fields (if in scope):
- User identifier
- Target type (post or comment)
- Target identifier
- Reaction type or emoji identifier
- Creation timestamp

### 2.7 Privacy Rules

Per-space privacy configuration, if not already embedded in the spaces export.

Required fields:
- Space identifier
- Visibility level (public, members-only, private, secret, or equivalent)
- Whether join approval is required
- Whether post approval is required
- Whether the space appears in public directories

### 2.8 Attachments and Media

All media items attached to posts or comments.

Required fields:
- Attachment identifier
- Parent post or comment identifier
- File URL or relative path in WordPress uploads directory
- MIME type or file extension
- File size in bytes
- Upload timestamp
- Alt text or caption if stored

### 2.9 Moderation State

All moderation actions and their current outcomes.

Required fields:
- Moderator user identifier
- Action type (hide, delete, ban, unban, restore, or equivalent)
- Target type (post, comment, membership, user, or equivalent)
- Target identifier
- Action reason or note
- Action timestamp
- Whether the action is currently in effect

### 2.10 Timestamps

All records in all export artifacts must carry:
- Creation timestamp in UTC ISO-8601 format
- Last-updated timestamp in UTC ISO-8601 format

If timestamps are in a different format or timezone, the operator must document the encoding before adapter work begins.

### 2.11 Deleted and Suspended Records

Soft-deleted posts, suspended users, and banned memberships must be included in the export with their deletion or suspension timestamps. Hard-deleted records that cannot be exported must be counted and the count provided to the operator.

---

## 3. Adapter Interface Contract

The following TypeScript interfaces define the conceptual shape of the adapter. These are placeholder shapes only. All field names marked with a comment are unconfirmed and must be validated against the actual export before the parser is written.

```typescript
// Configuration passed to the adapter at runtime.
export interface FluentCommunityConfig {
  exportDirectory: string        // Absolute path to the directory containing export artifacts
  dryRun: boolean                // When true, no writes are performed
  batchSize?: number             // Records per commit batch; default 50
  skipReactions?: boolean        // When true, reaction records are not imported
  attachmentStrategy: 'reference-only' | 'download-approved'
  // 'reference-only' stores source URLs in metadata and does not download files.
  // 'download-approved' is not permitted without explicit operator authorization.
}

// Top-level source record produced by the export parser before mapping.
// All field names are unconfirmed placeholders.
export interface FluentCommunitySource {
  users: FluentCommunityMember[]
  spaces: FluentCommunitySpace[]
  memberships: FluentCommunityMembership[]
  posts: FluentCommunityPost[]
  comments: FluentCommunityComment[]
  attachments: FluentCommunityAttachment[]
  reactions?: FluentCommunityReaction[]
  moderationEvents?: FluentCommunityModerationEvent[]
}

// A Fluent Community user record as it appears in the export.
// Field names are unconfirmed.
export interface FluentCommunityMember {
  fc_user_id: unknown            // Fluent Community user identifier — type unconfirmed
  wp_user_id: number | null      // WordPress user ID — may be the same value
  email: string
  display_name: string
  joined_at: string              // Timestamp format unconfirmed
  account_status: string         // Exact status values unconfirmed
}

// A Fluent Community space (group) record.
export interface FluentCommunitySpace {
  space_id: unknown              // Type unconfirmed
  name: string
  slug: string
  space_type: string             // Exact type vocabulary unconfirmed
  privacy_level: string          // Exact values unconfirmed
  owner_id: unknown
  created_at: string
  updated_at: string
  status: string
}

// A user-to-space membership record.
export interface FluentCommunityMembership {
  user_id: unknown
  space_id: unknown
  role: string                   // Exact role vocabulary unconfirmed
  status: string                 // Exact status vocabulary unconfirmed
  joined_at: string
  banned_at?: string
  removed_at?: string
  ban_reason?: string
}

// A community post record.
export interface FluentCommunityPost {
  post_id: unknown
  space_id: unknown
  author_id: unknown
  post_type: string              // Exact type vocabulary unconfirmed
  content: string                // Format (HTML, Markdown, blocks) unconfirmed
  status: string                 // Exact status vocabulary unconfirmed
  pinned: boolean
  locked: boolean
  created_at: string
  updated_at: string
}

// A comment or reply record.
export interface FluentCommunityComment {
  comment_id: unknown
  post_id: unknown
  parent_comment_id: unknown | null
  author_id: unknown
  content: string
  status: string
  created_at: string
  updated_at: string
}

// A media attachment record.
export interface FluentCommunityAttachment {
  attachment_id: unknown
  post_id: unknown | null
  comment_id: unknown | null
  file_url: string               // May be absolute URL or relative path — unconfirmed
  mime_type: string
  file_size_bytes: number | null
  alt_text?: string
  caption?: string
  uploaded_at: string
}

// A reaction record (optional; only if reactions are in scope).
export interface FluentCommunityReaction {
  user_id: unknown
  target_type: 'post' | 'comment'  // Exact vocabulary unconfirmed
  target_id: unknown
  reaction_type: string
  created_at: string
}

// A moderation event record.
export interface FluentCommunityModerationEvent {
  moderator_id: unknown
  action: string
  target_type: string
  target_id: unknown
  reason?: string
  actioned_at: string
  is_active: boolean
}

// Summary result returned by a completed import run.
export interface FluentCommunityImportResult {
  runId: string
  startedAt: string
  completedAt: string
  dryRun: boolean
  spacesCreated: number
  spacesSkipped: number
  membershipsCreated: number
  membershipsSkipped: number
  postsCreated: number
  postsSkipped: number
  commentsCreated: number
  commentsSkipped: number
  attachmentRefsRecorded: number
  reactionsImported: number
  identityResolutionFailures: number   // FC users with no crosswalk match
  moderationStatusApplied: number
  errors: FluentCommunityImportError[]
}

export interface FluentCommunityImportError {
  entityType: string
  sourceId: string
  reason: string
  fatal: boolean
}
```

---

## 4. Canonical Intermediate Model

The following table maps each Fluent Community entity to its Payload collection. Collection slugs are from the live schema in `src/collections/community/Community.ts`.

| FC Entity | Payload Collection | Notes |
|-----------|-------------------|-------|
| Space | `payload_spaces` | `visibility` mapped from FC privacy level; `spaceType` mapped from FC space type |
| Space membership | `payload_space_memberships` | `role` and `status` values must be mapped to Payload enums |
| Post | `payload_space_posts` | `body` is a Payload richText field; FC content format must be converted |
| Comment / reply | `payload_space_comments` | Parent threading recorded in `metadata` if Payload schema does not natively support nested comments |
| Media attachment | `payload_space_files` | In `reference-only` mode, source URL stored in `metadata`; no upload collection record created |
| Reaction | `metadata` on the target post or comment record | No dedicated reactions collection exists; reactions are stored as structured metadata |
| Moderation event | `moderationStatus` field on the target record | Payload uses `visible`, `pending_review`, `hidden`, `deleted`; FC values must be mapped |
| FC user identity | `payload_members` (via crosswalk) | FC users are not created as new member records; they must resolve to existing `payload_members` rows via the identity crosswalk |

---

## 5. Privacy Mapping Requirements

Fluent Community privacy levels must be mapped to Payload `payload_spaces.visibility` values before any space is written. The mapping must be documented in the adapter config and operator-approved.

| FC Privacy Level (unconfirmed) | Payload visibility | Notes |
|-------------------------------|-------------------|-------|
| Public (anyone can see and join) | `public` | |
| Members-only (logged-in members only) | `members` | |
| Private (invite-only or approval-required) | `private` | |
| Secret (unlisted, invite-only) | `secret` | |

If FC uses values that do not map cleanly to one of the four Payload options, the adapter must fail with an explicit unmapped-privacy-level error rather than silently defaulting. The operator must resolve unmapped values before the import run proceeds.

Join-approval and post-approval flags from FC privacy rules must be preserved in `metadata` on the space record, even if Payload does not currently enforce them programmatically.

---

## 6. Author Mapping

Every authored entity (post, comment, attachment, reaction) must be resolved to a `payload_members` row before the record is written. The resolution path is:

1. Take the FC `author_id` (or `user_id`, or `uploaded_by`) from the source record.
2. Look up the corresponding `fluent_community_user_id` in the identity crosswalk (see Section 4.1 of `LEGACY_PLATFORM_IMPORT_MASTER_PLAN.md`).
3. Use the crosswalk row's `payload_member_id` as the Payload relationship target.

If the crosswalk row does not exist or `payload_member_id` is null (wave 4 not yet applied), the record must be held in a deferred queue and not written. The adapter must not substitute a placeholder author or an admin user ID.

If `identity_confidence` on the crosswalk row is `unresolved`, the record must be held and an error logged. No authored record may be written against an unresolved identity.

The crosswalk must be frozen (SHA-256 computed and recorded) before the Fluent Community import wave begins.

---

## 7. Attachment Handling

The adapter operates in `reference-only` mode by default. In this mode:

- No files are downloaded from the FC instance or from any CDN.
- A `payload_space_files` record is created for each attachment with `attachmentType` set to the closest available option and the source URL stored in the record's `metadata` field under the key `fcSourceUrl`.
- The `file` and `protectedFile` upload fields are left null.
- A separate operator-authorized download pass must be run to resolve these references into actual Payload media records.

The `download-approved` strategy may not be used without:
1. Written operator authorization specifying which spaces or post types are in scope for download.
2. A confirmed accessible URL for the FC media files (the operator must verify that the WordPress uploads directory is reachable or that media has been exported to a local directory).
3. A confirmed media storage destination (Bunny CDN vs. Payload-managed uploads vs. private media).

Under no circumstances should the adapter attempt to re-host FC media files in a public Payload media collection without confirming the privacy intent of the source space.

---

## 8. Idempotency Keys

Each entity type requires a stable idempotency key that allows the adapter to detect an already-imported record and skip or update it without creating a duplicate.

| Entity | Idempotency Key | Storage Location |
|--------|----------------|-----------------|
| Space | `fc_space_id:<value>` | `payload_spaces.metadata.fcSpaceId` |
| Space membership | `fc_membership:<user_id>:<space_id>` | `payload_space_memberships.metadata.fcMembershipKey` |
| Post | `fc_post_id:<value>` | `payload_space_posts.metadata.fcPostId` |
| Comment | `fc_comment_id:<value>` | `payload_space_comments.metadata.fcCommentId` |
| Attachment ref | `fc_attachment_id:<value>` | `payload_space_files.metadata.fcAttachmentId` |
| Reaction | `fc_reaction:<user_id>:<target_type>:<target_id>:<reaction_type>` | Stored in parent record metadata array |
| Moderation event | `fc_mod_event:<action>:<target_type>:<target_id>:<actioned_at>` | Not written as a separate record; applied to target record moderation status |

All idempotency keys must be stored before the insert transaction commits. On rerun, the adapter must query for existing keys before attempting any write. A rerun must produce zero new records if the source data has not changed.

---

## 9. Reconciliation Requirements

After a successful import run, the following must be verified before the wave is marked closed:

1. **Space count.** The count of `payload_spaces` records with `metadata.fcSourceWave = 'fluent-community'` must equal the count of spaces in the discovery export.
2. **Membership count.** The count of `payload_space_memberships` records sourced from this wave must equal the count of memberships in the discovery export (excluding any that were held due to unresolved identities).
3. **Post count.** The count of `payload_space_posts` records from this wave must equal the published-post count in the discovery export. Deleted or hidden posts must be accounted for separately.
4. **Comment count.** Same verification as posts.
5. **Identity failures.** The count of FC user IDs that could not be resolved to a `payload_member_id` must be reported to the operator. These records must remain in the deferred queue until identities are resolved.
6. **Moderation state.** A sample of at least 10 posts and comments that carried non-visible moderation states in FC must be spot-checked in Payload to confirm the status was preserved correctly.
7. **Attachment refs.** Every `payload_space_files` record created in `reference-only` mode must have a non-null `metadata.fcSourceUrl` and a null `file` field.
8. **Privacy preservation.** At least one space of each privacy level present in the source must be verified to carry the correct `visibility` value in Payload.
9. **No orphaned records.** Every `payload_space_posts`, `payload_space_comments`, and `payload_space_files` record must have a valid relationship to a `payload_spaces` record created in this wave.
10. **Run artifact.** The `FluentCommunityImportResult` JSON must be written to `migration-run-artifacts/fluent-community-<runId>.json` and its SHA-256 recorded in `migration-inventory.json`.

---

## Status

**IMPORT ADAPTER NOT IMPLEMENTED — DISCOVERY EXPORT REQUIRED BEFORE DESIGN CAN ADVANCE**

Next required action: Operator must run a full discovery export from the live Fluent Community instance covering all entities in Section 2 and deliver the artifacts with row counts and checksums. No adapter code should be written before that export has been reviewed.

See `docs/migration/LEGACY_PLATFORM_IMPORT_MASTER_PLAN.md` Section 3.3 for context within the broader fifteen-wave migration plan.
