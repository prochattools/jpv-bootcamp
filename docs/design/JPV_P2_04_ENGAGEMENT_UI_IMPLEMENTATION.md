# JPV P2-04 Engagement UI Implementation

Status: complete — presentation-only foundation

This phase adds the first reusable engagement UI layer without activating engagement behavior. It preserves the existing service-layer comment flows and keeps all future persistence work outside the frontend presentation boundary.

## Components created

Canonical implementation: `src/components/community/EngagementPresentation.tsx`

- `EngagementReactionSummary` — presents aggregate reaction counts when a future projection supplies them, without inventing current counts.
- `EngagementReactionButton` — provides token-based idle, selected, and unavailable visual states. It is disabled unless a future integration supplies an explicit handler.
- `EngagementReactionBar` — composes the summary and explicitly labels the current surface as a read-only preview.
- `EngagementCommentActionBar` — standardizes comment counts and reply guidance without creating a new mutation path.
- `EngagementAuthorIdentity` — standardizes member initials, author names, optional context, and timestamps.
- `DiscussionHierarchy` — makes future reply depth visible while retaining the existing lesson discussion parent model.
- `EngagementFutureActions` — labels bookmarks and sharing as future work; it does not render active controls.

## Surfaces adopted

- Community post cards now use the shared author identity and comment action presentation.
- Community post detail uses the read-only engagement preview, future-action disclosure, shared discussion action bar, and shared comment identity.
- Lesson discussions use the shared engagement preview, discussion action bar, author identity, and hierarchy indicator for existing replies.

The existing community and lesson forms remain the only active comment entry points. No reaction, bookmark, sharing, notification, or new reply mutation was added.

## UX decisions

1. A missing reaction projection is shown as “Reactions pending,” never as a fabricated zero.
2. Reaction controls remain disabled until a future service supplies an authenticated handler.
3. Reply guidance is descriptive rather than an additional button, so it cannot imply unsupported nested community replies.
4. Author identity is consistently visible on compact cards and discussion items, with timestamps remaining source-driven.
5. Hierarchy is expressed with a restrained token-based border and bounded depth; existing lesson reply behavior is preserved.
6. Bookmarks and sharing are disclosed as future actions without creating misleading inactive-looking controls.

## Future API integration points

The presentation components intentionally accept data rather than querying Payload:

- `EngagementReactionSummary` accepts `counts` and `totalCount` from a future target projection.
- `EngagementReactionButton` accepts a future `onPress` handler and `state`; without a handler it remains disabled.
- `EngagementReactionBar` is the composition boundary for target-specific reaction projections.
- `EngagementCommentActionBar` receives a server-projected count and copy; it does not decide permissions.
- `EngagementAuthorIdentity` receives canonical display-name and timestamp values from the existing service projections.

Future services must continue to enforce the P2-03 contract: authenticated member identity comes from the session, target access is evaluated server-side, and mutations are not implemented by this phase.

## Validation evidence

The focused P2-04 contract test verifies:

- all reusable components exist and consume JPV token classes;
- unavailable reaction controls are explicitly disabled;
- future actions are non-interactive and honestly labelled;
- community and lesson surfaces adopt the shared components;
- the existing comment service and collection boundaries remain referenced;
- no new Payload collection, migration, API route, or server action is introduced by this phase.

Additional validation required before the phase is frozen:

- TypeScript compilation;
- P2-04 focused test;
- P2-01 course hierarchy and P2-02 community regression tests;
- responsive and accessibility checks;
- full release gate.

## Deferred backend work

The following remain explicitly out of scope:

- reaction persistence and target projections;
- reaction counts sourced from Payload;
- bookmark storage and retrieval;
- internal or external sharing;
- notifications;
- community comment threading or new reply mutations;
- collection changes, access-rule changes, hooks, API endpoints, and migrations.
