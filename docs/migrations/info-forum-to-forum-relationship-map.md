# Info Forum to Forum relationship map

This is a guarded, one-way consolidation of the archived `Info Forum` community space into the canonical `Forum` space. The migration resolves both records by exact slug and verifies the expected name before planning any write. It is dry-run by default; production application is intentionally outside this feature branch.

## Identity and safety

- Source: exact slug `info-forum`, expected name `Info Forum`.
- Destination: exact slug `forum`, expected name `Forum`.
- Source and destination IDs must be different and unique. Optional explicit IDs are checked against the same slug/name contract.
- The source is archived only after all direct references are rewritten. It is never deleted.
- A second run sees no source direct references and produces zero new operations. Destination memberships are deduplicated by member.
- The tool does not print member emails, post bodies, message bodies, or other PII.

## Relationship inventory and action

| Record | Relationship to source space | Action | Preservation rule |
| --- | --- | --- | --- |
| `payload_space_posts.space` | direct | rewrite to destination | Post IDs, authors, moderation, timestamps, and bodies stay unchanged. |
| `payload_space_comments.post` | indirect through post | preserve | Comments are not recreated or detached; their post relationship remains valid. |
| `payload_space_reactions.targetPost/targetComment` | indirect through post/comment | preserve | Reaction IDs and targets remain unchanged. |
| `payload_engagement_reactions.targetPost/targetSpaceComment` | indirect through post/comment | preserve | Current member reactions remain attached to the same post or comment. |
| `payload_space_files.space` | direct | rewrite to destination | `post` and `comment` relationships remain unchanged. |
| `payload_space_memberships.space` | direct | rewrite or deduplicate | One destination membership per member is retained; source duplicate is deleted only when the destination membership already exists. |
| `payload_chat_threads.space` | direct | rewrite to destination | Chat thread IDs and participants remain unchanged. |
| `payload_chat_messages.thread` | indirect through thread | preserve | Messages remain attached to the same thread. |
| `live_sessions.space` | direct | rewrite to destination | Room history and invitation ledger references are retained. |
| `payload_access_policies.resourceId` | polymorphic `resourceType=space` | rewrite to destination | Non-space policies are untouched. |
| `payload_access_grants.resourceId` | polymorphic `resourceType=space` | rewrite to destination | Non-space grants are untouched. |
| `payload_entitlement_events.resourceId` | polymorphic `resourceType=space` | rewrite to destination | Audit history remains intact and only the resource ID changes. |
| `payload_member_notifications.href` | route deep link | rewrite exact `/portal/community/info-forum` prefix | Other notification links are untouched. |

The inventory also counts indirect comments, both legacy and current engagement reactions, and chat messages so dry-run output proves they are preserved rather than copied. It reports simulated remaining direct dependencies and conflicts before any apply. `payload_spaces.requiredAccessGroups` is not rewritten: it points to the separate `payload_access_groups` product-access domain, not member communication groups.

A schema search found no direct course, cohort, or enrollment relationship to
`payload_spaces`; the only current cross-domain Room relationship is
`live_sessions.space`, which is included above. Unknown future relationships must
be added to this map before applying the migration.

## Execution contract

```text
pnpm migration:info-forum-to-forum
pnpm migration:info-forum-to-forum -- --source-id <id> --destination-id <id>
pnpm migration:info-forum-to-forum -- --apply
```

The first two commands only inventory and print a plan. `--apply` is explicit and remains a release/operator action requiring an independently approved environment and backup/preflight packet. This branch must not run it against production.
