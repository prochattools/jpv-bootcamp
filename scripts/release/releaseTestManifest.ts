export const RELEASE_TEST_CATEGORIES = [
  'toolchain and install integrity',
  'TypeScript and production build',
  'Prisma schema validation',
  'migration inventory, readiness, rehearsal, and rollback safety',
  'public copy, legal, sitemap, and milestone checks',
  'public-request safety and guarded write routes',
  'support-intake persistence, dedupe, queue, review, and failure behavior',
  'authentication and account security',
  'member portal and entitlement behavior',
  'Payload admin, editor, collection, and access behavior',
  'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling',
  'email queue, retry, and redaction behavior',
  'sponsored application, review, and access behavior',
  'route architecture and MVP integration',
  'dependency audit disposition',
  'release evidence and operator handoff checks',
] as const

export type ReleaseTestCategory = (typeof RELEASE_TEST_CATEGORIES)[number]

export type ReleaseTestCommand = {
  executable: 'pnpm' | 'git'
  args: string[]
}

export type ReleaseTestEntry = {
  id: string
  category: ReleaseTestCategory
  command: ReleaseTestCommand
  testPath?: string
  launchCriticalReason: string
  requirement: 'required' | 'conditional'
  condition?: string
  failureMeaning: string
  owner: string
  covers: string[]
}

export type DeferredReleaseValidation = {
  id: string
  owner: string
  reason: string
}

function test(
  id: string,
  category: ReleaseTestCategory,
  testPath: string,
  launchCriticalReason: string,
  failureMeaning: string,
  owner: string,
  covers: string[] = [],
): ReleaseTestEntry {
  return {
    id,
    category,
    command: { executable: 'pnpm', args: ['exec', 'tsx', testPath] },
    testPath,
    launchCriticalReason,
    requirement: 'required',
    failureMeaning,
    owner,
    covers,
  }
}

function command(
  id: string,
  category: ReleaseTestCategory,
  executable: 'pnpm' | 'git',
  args: string[],
  launchCriticalReason: string,
  failureMeaning: string,
  owner: string,
  covers: string[] = [],
): ReleaseTestEntry {
  return {
    id,
    category,
    command: { executable, args },
    launchCriticalReason,
    requirement: 'required',
    failureMeaning,
    owner,
    covers,
  }
}

export const RELEASE_TEST_MANIFEST: ReleaseTestEntry[] = [
  command('toolchain.frozen-install', 'toolchain and install integrity', 'pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], 'Proves package.json and pnpm-lock.yaml install deterministically without regeneration.', 'The pinned dependency graph cannot be reproduced safely.', 'M1-02'),
  command('toolchain.contract', 'toolchain and install integrity', 'pnpm', ['toolchain:check'], 'Enforces the repository Node and pnpm contracts before release checks.', 'The current runtime does not match the supported toolchain.', 'M1-02'),
  command('toolchain.diff-check', 'toolchain and install integrity', 'git', ['diff', '--check'], 'Rejects whitespace errors in the exact release candidate diff.', 'The release candidate contains invalid patch whitespace.', 'M1-02'),
  test('toolchain.preflight-test', 'toolchain and install integrity', 'scripts/toolchain_preflight.test.ts', 'Protects the toolchain preflight contract.', 'Toolchain validation can silently drift.', 'M1-02'),
  test('toolchain.static-preflight-package', 'toolchain and install integrity', 'scripts/staging_static_preflight_package.test.ts', 'Protects the existing static-preflight safety contract.', 'Static preflight may omit core checks or gain unsafe commands.', 'M1-02'),

  command('compile.typescript', 'TypeScript and production build', 'pnpm', ['exec', 'tsc', '--noEmit', '--pretty', 'false', '--incremental', 'false'], 'Compiles the full TypeScript graph without generated output.', 'A source or contract change does not type-check.', 'M1-02'),
  command('compile.production-build', 'TypeScript and production build', 'pnpm', ['build'], 'Compiles the production Next.js and Payload application.', 'The deployable application cannot be built.', 'M1-02'),

  command('prisma.system-schema', 'Prisma schema validation', 'pnpm', ['exec', 'prisma', 'validate', '--schema=prisma/system.prisma'], 'Validates the runtime Prisma schema.', 'The runtime database contract is invalid.', 'M1-02'),
  command('prisma.secondary-schema', 'Prisma schema validation', 'pnpm', ['exec', 'prisma', 'validate', '--schema=prisma/schema.prisma'], 'Validates the secondary repository Prisma schema.', 'The secondary database contract is invalid.', 'M1-02'),

  test('migration.inventory', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/preview_migration_inventory.test.ts', 'Verifies the release migration inventory without applying migrations.', 'Required migrations are missing, reordered, or incorrectly represented.', 'M1-02'),
  test('migration.readiness', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/migration_readiness_static.test.ts', 'Protects approval and migration-readiness boundaries.', 'Migration readiness evidence or hard stops are incomplete.', 'M1-02'),
  test('migration.rehearsal', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/migration_rehearsal_safety.test.ts', 'Protects rehearsal and rollback safety without database mutation.', 'Rehearsal or rollback controls are unsafe.', 'M1-02'),
  test('migration.subscription-projection-sql', 'migration inventory, readiness, rehearsal, and rollback safety', 'prisma/migrations/20260703_120000_add_subscription_projection.test.ts', 'Validates additive subscription-projection migration SQL.', 'Subscription projection migration safety regressed.', 'M1-02'),
  test('migration.subscription-commitment-sql', 'migration inventory, readiness, rehearsal, and rollback safety', 'prisma/migrations/20260710_214000_add_subscription_commitment_projection.test.ts', 'Validates additive commitment-projection migration SQL.', 'Commitment migration safety regressed.', 'M0-05', ['M0-05']),
  test('migration.support-request-sql', 'migration inventory, readiness, rehearsal, and rollback safety', 'prisma/migrations/20260712_151700_add_support_requests.test.ts', 'Validates the unapplied support-request migration and rollback notes.', 'Support intake cannot be released safely after migration approval.', 'M1-01', ['M1-01']),
  test('migration.subscription-contract', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/subscription_projection_migration.test.ts', 'Protects the subscription projection schema contract.', 'Webhook projection and schema expectations diverged.', 'M0-05', ['M0-05']),
  test('migration.payload-preferences', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/payload_preferences_constraint_migration.test.ts', 'Protects Payload preference constraint migration safety.', 'Payload admin preference migration safety regressed.', 'Payload'),
  test('migration.payload-staging-boundary', 'migration inventory, readiness, rehearsal, and rollback safety', 'scripts/payload_staging_migration_boundary.test.ts', 'Ensures staging migration actions remain separately authorized.', 'Release validation could apply migrations implicitly.', 'M1-02'),

  test('public.status-docs', 'public copy, legal, sitemap, and milestone checks', 'scripts/status_docs_consistency.test.ts', 'Keeps operator and client status documents aligned with Version 3.5 truth.', 'Release status documents contradict the canonical plan.', 'M1-02'),
  test('public.v34-baseline', 'public copy, legal, sitemap, and milestone checks', 'scripts/v34_go_live_plan_static.test.ts', 'Preserves the Version 3.4 summary only as the documented prior baseline.', 'Historical baseline evidence or migration warnings were lost.', 'M1-02'),
  test('public.frontend-milestone', 'public copy, legal, sitemap, and milestone checks', 'scripts/frontend_milestone_static.test.ts', 'Protects launch pricing, CTA, and milestone presentation.', 'The public milestone or product offer regressed.', 'M0-02', ['M0-02']),
  test('public.copy-approval', 'public copy, legal, sitemap, and milestone checks', 'scripts/frontend_copy_approval_static.test.ts', 'Requires approved public-copy evidence and safe claims.', 'Public copy lacks approval or over-promises behavior.', 'M0-02', ['M0-02']),
  test('public.content-request', 'public copy, legal, sitemap, and milestone checks', 'scripts/frontend_content_request_static.test.ts', 'Protects the client-content request and tracking contract.', 'Required launch content ownership is unclear.', 'M1-02'),
  test('public.acceptance-evidence', 'public copy, legal, sitemap, and milestone checks', 'scripts/frontend_acceptance_evidence_static.test.ts', 'Protects the front-end acceptance evidence template.', 'Public acceptance cannot be evidenced consistently.', 'M1-02'),
  test('public.copy-claims', 'public copy, legal, sitemap, and milestone checks', 'scripts/public_copy_claims_cleanup.test.ts', 'Prevents unsupported public workflow and billing claims.', 'The public site can claim behavior the runtime does not provide.', 'M0-02', ['M0-02']),
  test('public.legal-routes', 'public copy, legal, sitemap, and milestone checks', 'scripts/legal_public_route_cleanup.test.ts', 'Protects canonical legal routes and sitemap cleanup.', 'Legacy template or legal routes are publicly reachable.', 'M0-02', ['M0-02']),
  test('public.course-programme', 'public copy, legal, sitemap, and milestone checks', 'scripts/course_programme_mvp.test.ts', 'Protects the public course programme contract.', 'The advertised programme no longer matches the implementation.', 'M1-02'),

  test('request.shared-guard', 'public-request safety and guarded write routes', 'scripts/public_request_guard.test.ts', 'Protects method, content-type, Origin, size, schema, redirect, rate-limit, and redaction controls.', 'Public write endpoints can bypass the shared safety boundary.', 'M0-07', ['M0-07']),
  test('request.route-adoption', 'public-request safety and guarded write routes', 'scripts/public_write_route_guard_adoption.test.ts', 'Ensures every public write route invokes the guard before services.', 'A rejected request can reach persistence, email, or Stripe.', 'M0-08', ['M0-08']),
  test('request.account-actions', 'public-request safety and guarded write routes', 'scripts/account_action_route_safety.test.ts', 'Protects account action routes from unsafe request handling.', 'Account actions can be invoked outside approved safety boundaries.', 'M1-02'),
  test('request.preview-submissions', 'public-request safety and guarded write routes', 'scripts/portal_preview_submission_guard.test.ts', 'Keeps unfinished submission workflows non-operational.', 'A preview-only workflow can falsely claim acceptance.', 'M0-04', ['M0-04']),

  test('support.runtime', 'support-intake persistence, dedupe, queue, review, and failure behavior', 'scripts/support_intake_runtime.test.ts', 'Proves persistence-first acceptance, bounded dedupe, queue ordering, retry state, and safe responses.', 'Support intake can lose requests, duplicate notifications, or expose sensitive values.', 'M1-01', ['M1-01']),
  test('support.schema-contract', 'support-intake persistence, dedupe, queue, review, and failure behavior', 'scripts/support_request_schema_contract.test.ts', 'Protects the dedicated support-request domain and no-access boundary.', 'Support intake schema or route behavior can drift into sponsored access.', 'M1-01', ['M1-01']),
  test('support.pay-it-forward', 'support-intake persistence, dedupe, queue, review, and failure behavior', 'scripts/pay_it_forward_mvp.test.ts', 'Protects controlled Free/pay-it-forward behavior around support intake.', 'Support submission semantics can grant or promise unsupported access.', 'M1-01', ['M1-01']),

  test('auth.architecture', 'authentication and account security', 'scripts/payload_member_auth_architecture.test.ts', 'Protects the server-derived Payload member authentication architecture.', 'Authentication ownership or trust boundaries regressed.', 'M1-02'),
  test('auth.flow', 'authentication and account security', 'scripts/payload_member_auth_flow.test.ts', 'Validates member login, session, and logout behavior.', 'Members cannot authenticate safely.', 'M1-02'),
  test('auth.registration', 'authentication and account security', 'scripts/payload_member_registration.test.ts', 'Protects member registration validation and persistence boundaries.', 'Registration can create unsafe or inconsistent accounts.', 'M1-02'),
  test('auth.email-verification', 'authentication and account security', 'scripts/payload_member_email_verification.test.ts', 'Protects verification token and state handling.', 'Unverified identities can bypass account controls.', 'M1-02'),
  test('auth.email-verification-integration', 'authentication and account security', 'scripts/payload_member_email_verification_integration.test.ts', 'Protects verification route and service integration.', 'Verification routes and account state diverged.', 'M1-02'),
  test('auth.email-change', 'authentication and account security', 'scripts/payload_member_email_change.test.ts', 'Protects authenticated email-change behavior.', 'Email identity changes can bypass verification.', 'M1-02'),
  test('auth.password-forms', 'authentication and account security', 'scripts/payload_member_password_forms.test.ts', 'Protects password request form safety and copy.', 'Password workflows can leak state or accept unsafe input.', 'M1-02'),
  test('auth.password-reset', 'authentication and account security', 'scripts/payload_member_password_reset_completion.test.ts', 'Protects password reset completion and token handling.', 'Password reset can be replayed or completed incorrectly.', 'M1-02'),
  test('auth.account-actions', 'authentication and account security', 'scripts/payload_member_account_actions.test.ts', 'Protects account status and security actions.', 'Account actions can bypass authorization or state checks.', 'M1-02'),
  test('auth.account-email-routes', 'authentication and account security', 'scripts/payload_member_account_email_routes.test.ts', 'Protects account email route boundaries and redaction.', 'Account email routes can leak or send unsafely.', 'M1-02'),
  test('auth.security-controls', 'authentication and account security', 'scripts/payload_member_security_controls.test.ts', 'Protects member security controls and authorization checks.', 'Member account security controls regressed.', 'M1-02'),
  test('auth.billing-portal-token', 'authentication and account security', 'scripts/billing-portal-token.test.ts', 'Protects signed billing-portal token behavior.', 'Billing portal access can be forged or replayed.', 'M1-02'),

  test('member.portal-mvp', 'member portal and entitlement behavior', 'scripts/member_portal_mvp.test.ts', 'Protects canonical member portal routes and states.', 'The member portal cannot provide the launch-critical member journey.', 'M1-02'),
  test('member.payload-portal', 'member portal and entitlement behavior', 'scripts/payload_member_portal.test.ts', 'Protects Payload-backed member portal data access.', 'Member portal data can bypass authorization or fail to load.', 'M1-02'),
  test('member.entitlement-evaluator', 'member portal and entitlement behavior', 'scripts/payload_entitlement_evaluator.test.ts', 'Protects entitlement state evaluation.', 'Member access can be granted or removed incorrectly.', 'M1-02'),
  test('member.access-service', 'member portal and entitlement behavior', 'scripts/payload_course_access_service.test.ts', 'Protects course access and sponsored-boundary rules.', 'Course access can bypass approved entitlement rules.', 'M1-02'),
  test('member.billing-overview', 'member portal and entitlement behavior', 'scripts/payload_member_billing_overview.test.ts', 'Protects member billing projection presentation.', 'Member billing state can be misleading or stale.', 'M1-02'),
  test('member.billing-portal', 'member portal and entitlement behavior', 'scripts/payload_member_billing_portal.test.ts', 'Protects billing portal initiation from member context.', 'Members can access another account or an invalid portal session.', 'M1-02'),
  test('member.billing-portal-refinement', 'member portal and entitlement behavior', 'scripts/payload_member_billing_portal_refinement.test.ts', 'Protects refined billing portal failure and state handling.', 'Billing portal errors can produce unsafe member behavior.', 'M1-02'),
  test('member.open-billing-script', 'member portal and entitlement behavior', 'scripts/openBillingPortal.test.ts', 'Protects the public billing portal action contract.', 'Billing portal action behavior regressed.', 'M1-02'),
  test('member.open-billing-unit', 'member portal and entitlement behavior', 'src/lib/actions/openBillingPortal.test.ts', 'Protects the server action unit boundary.', 'The billing portal action can trust client identity.', 'M1-02'),

  test('payload.admin-branding', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_admin_branding.test.ts', 'Protects the Payload admin entry point and branding configuration.', 'The administrator surface cannot compile or identify the product.', 'M0-09', ['M0-09']),
  test('payload.admin-dashboard', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_admin_dashboard.test.ts', 'Protects authenticated operational dashboard behavior.', 'Operators lose the canonical review surface.', 'M0-01', ['M0-01']),
  test('payload.admin-logout', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_admin_logout_route.test.ts', 'Protects administrator logout route behavior.', 'Admin sessions cannot terminate safely.', 'M0-01', ['M0-01']),
  test('payload.course-admin-services', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_course_admin_services.test.ts', 'Protects course collection and editor configuration.', 'Course administration or editor fields regressed.', 'M0-09', ['M0-09']),
  test('payload.identity-destination', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_identity_destination.test.ts', 'Protects identity routing between public, member, and admin destinations.', 'Authenticated users can be routed to the wrong surface.', 'M1-02'),
  test('payload.community-portal', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_portal.test.ts', 'Protects authorized community portal reads.', 'Community data can be exposed or unavailable.', 'M1-02'),
  test('payload.community-posting', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_posting.test.ts', 'Protects authorized community posting.', 'Members can post outside authorized spaces.', 'M1-02'),
  test('payload.community-files', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_files.test.ts', 'Protects community file ownership and access.', 'Private community files can leak.', 'M1-02'),
  test('payload.community-file-delivery', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_file_delivery.test.ts', 'Protects authenticated file delivery.', 'File delivery can bypass membership checks.', 'M1-02'),
  test('payload.community-discussion', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_discussion.test.ts', 'Protects discussion read/write rules.', 'Discussion permissions or moderation state regressed.', 'M1-02'),
  test('payload.community-moderation', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_community_moderation.test.ts', 'Protects community moderation controls.', 'Unauthorized members can moderate content.', 'M1-02'),
  test('payload.space-memberships', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_space_memberships.test.ts', 'Protects private-space membership rules.', 'Private spaces can be accessed without membership.', 'M1-02'),
  test('payload.lesson-resources', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_lesson_resource_delivery.test.ts', 'Protects authorized lesson resource delivery.', 'Course resources can leak or fail for entitled members.', 'M1-02'),
  test('payload.member-announcements', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_member_announcements.test.ts', 'Protects targeted member announcements.', 'Announcements can cross audience boundaries.', 'M1-02'),
  test('payload.member-profile', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_member_profile_update.test.ts', 'Protects member profile update validation.', 'Members can update protected identity fields.', 'M1-02'),
  test('payload.deployment-health', 'Payload admin, editor, collection, and access behavior', 'scripts/payload_deployment_health.test.ts', 'Protects non-mutating Payload deployment health checks.', 'Release health checks no longer reflect application readiness.', 'M1-02'),

  test('stripe.checkout', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/stripe_checkout_validation.test.ts', 'Protects controlled Pro and support checkout inputs.', 'Checkout can accept unsupported plans, amounts, or redirects.', 'M0-05', ['M0-05']),
  test('stripe.member-checkout', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/member_checkout.test.ts', 'Protects server-derived member checkout identity.', 'Checkout can trust client-supplied member identity.', 'M0-05', ['M0-05']),
  test('stripe.commitment', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/stripe_commitment_contract.test.ts', 'Protects the approved 12-month commitment lifecycle.', 'Stripe schedules and public commitment language diverged.', 'M0-03/M0-05', ['M0-03', 'M0-05']),
  test('stripe.subscription-projection', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'src/lib/provisioning.subscription-projection.test.ts', 'Protects webhook projection, idempotency, and lifecycle states.', 'Stripe webhook events can project inconsistent billing state.', 'M0-05', ['M0-05']),
  test('stripe.shadow-sync', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/payload_course_stripe_shadow_sync.test.ts', 'Protects Stripe-to-Payload shadow synchronization.', 'Billing events can diverge from Payload access state.', 'M0-09', ['M0-09']),
  test('stripe.shadow-validation', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/payload_shadow_validation.test.ts', 'Protects shadow event validation and rejection.', 'Malformed webhook projection data can be accepted.', 'M1-02'),
  test('stripe.shadow-adapter', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/payload_shadow_adapter.test.ts', 'Protects the Payload shadow adapter contract.', 'Webhook projection and Payload persistence diverged.', 'M1-02'),
  test('stripe.shadow-reconciliation', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/payload_shadow_reconciliation.test.ts', 'Protects billing reconciliation behavior.', 'Billing and entitlement inconsistencies cannot be detected.', 'M1-02'),
  test('stripe.refund-dispute', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/billing_refund_dispute.test.ts', 'Protects refund and dispute access transitions.', 'Refunds or disputes can leave incorrect access.', 'M0-05', ['M0-05']),
  test('stripe.payment-communications', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/billing_payment_communications.test.ts', 'Protects invoice failure, recovery, and member communications.', 'Payment failures or recoveries can produce incorrect state or messages.', 'M1-02'),
  test('stripe.membership-email-gate', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/stripe_membership_email_gate.test.ts', 'Protects billing-event email idempotency.', 'Stripe events can trigger duplicate or premature email.', 'M1-02'),
  test('stripe.membership-email-copy', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/membership_email_copy.test.ts', 'Protects commitment and payment email wording.', 'Member billing email copy contradicts the product contract.', 'M0-05', ['M0-05']),
  test('stripe.billing-readiness', 'Stripe checkout, webhook, schedule, invoice, recovery, refund, and dispute handling', 'scripts/billing_readiness_report.test.ts', 'Protects release billing-readiness evidence.', 'Billing release blockers cannot be identified consistently.', 'M1-02'),

  test('email.queue-sender', 'email queue, retry, and redaction behavior', 'scripts/payload_course_email_sender.test.ts', 'Protects durable queue processing, retries, and redaction.', 'Queued email can duplicate, lose retry state, or expose provider details.', 'M1-01', ['M1-01']),
  test('email.admin-queue-route', 'email queue, retry, and redaction behavior', 'scripts/payload_admin_queued_emails_route.test.ts', 'Protects authorized queued-email administration.', 'Unauthorized users can inspect or dispatch queued email.', 'M1-01', ['M1-01']),
  test('email.member-invitation', 'email queue, retry, and redaction behavior', 'scripts/payload_member_invitation.test.ts', 'Protects durable member invitation queueing.', 'Invitations can be duplicated or sent before persistence.', 'M1-02'),
  test('email.member-invitation-route', 'email queue, retry, and redaction behavior', 'scripts/payload_member_invitation_route.test.ts', 'Protects invitation route authorization and responses.', 'Invitation routes can leak identities or bypass authorization.', 'M1-02'),
  test('email.verification-support', 'email queue, retry, and redaction behavior', 'scripts/payload_member_verification_support.test.ts', 'Protects support-assisted verification without sensitive logs.', 'Verification support can expose member identity or tokens.', 'M1-02'),

  test('sponsored.review-access', 'sponsored application, review, and access behavior', 'scripts/admin_review_access.test.ts', 'Protects administrator-only review access.', 'Anonymous or member users can review applications.', 'M0-01', ['M0-01']),
  test('sponsored.review-workflow', 'sponsored application, review, and access behavior', 'scripts/admin_review_mvp.test.ts', 'Protects sponsored approval and rejection behavior.', 'Sponsored review can grant access outside approved paths.', 'M0-01', ['M0-01']),
  test('sponsored.applications', 'sponsored application, review, and access behavior', 'scripts/payload_partner_applications.test.ts', 'Protects durable application persistence and review state.', 'Applications can be lost, duplicated, or auto-approved.', 'M1-02'),
  test('sponsored.operations', 'sponsored application, review, and access behavior', 'scripts/payload_partner_operations.test.ts', 'Protects authorized partner and sponsored operations.', 'Partner operations can bypass administrator boundaries.', 'M1-02'),
  test('sponsored.referral', 'sponsored application, review, and access behavior', 'scripts/partner_referral_mvp.test.ts', 'Keeps referral behavior within its approved preview boundary.', 'Referral workflows can falsely claim persistence or rewards.', 'M1-02'),

  test('routes.architecture', 'route architecture and MVP integration', 'scripts/route_architecture_alignment.test.ts', 'Protects canonical public, portal, API, and admin route ownership.', 'Duplicate or public operator routes can reappear.', 'M0-01', ['M0-01']),
  test('routes.mvp-integration', 'route architecture and MVP integration', 'scripts/mvp_route_integration.test.ts', 'Protects cross-feature route integration and imports.', 'Launch-critical routes no longer compose safely.', 'M1-02'),
  test('routes.community-preview', 'route architecture and MVP integration', 'scripts/community_preview_mvp.test.ts', 'Protects community preview routing and access claims.', 'Community preview can over-promise persisted behavior.', 'M1-02'),

  command('audit.production-high', 'dependency audit disposition', 'pnpm', ['exec', 'pnpm', 'audit', '--prod', '--audit-level', 'high'], 'Fails release validation on any high or critical production advisory.', 'A high or critical production dependency advisory is unresolved.', 'M0-06/M0-09', ['M0-06', 'M0-09']),

  test('evidence.artifact-automation', 'release evidence and operator handoff checks', 'scripts/evidence_artifact_automation.test.ts', 'Protects deterministic local evidence generation boundaries.', 'Release evidence cannot be created safely or repeatably.', 'M1-02'),
  test('evidence.package-scripts', 'release evidence and operator handoff checks', 'scripts/evidence_package_scripts.test.ts', 'Protects evidence package command ownership.', 'Evidence commands can mutate or claim unsupported results.', 'M1-02'),
  test('evidence.committed-guard', 'release evidence and operator handoff checks', 'scripts/committed_evidence_guard.test.ts', 'Prevents unapproved evidence drafts from being committed.', 'Draft or fabricated evidence can enter release history.', 'M1-02'),
  test('evidence.staging-static', 'release evidence and operator handoff checks', 'scripts/staging_evidence_static.test.ts', 'Protects staging evidence completeness and hard stops.', 'Staging evidence can omit migration or provider state.', 'M1-02'),
  test('evidence.operator-handoff', 'release evidence and operator handoff checks', 'scripts/operator_handoff_static.test.ts', 'Protects operator handoff sequence and release blockers.', 'Operators can act from incomplete or unsafe instructions.', 'M1-02'),
  test('evidence.preview-readiness', 'release evidence and operator handoff checks', 'scripts/preview_readiness_config.test.ts', 'Protects non-production preview configuration.', 'Preview validation can target production or require secrets.', 'M1-02'),
  test('evidence.preview-startup', 'release evidence and operator handoff checks', 'scripts/preview_startup_mode.test.ts', 'Protects application-only preview startup.', 'Preview startup can apply migrations implicitly.', 'M1-02'),
  test('evidence.preview-workflow', 'release evidence and operator handoff checks', 'scripts/preview_workflow_safety.test.ts', 'Protects feature-branch validation from deployment actions.', 'Validation CI can publish, deploy, or apply providers.', 'M1-02'),
  test('evidence.preview-manifest', 'release evidence and operator handoff checks', 'scripts/preview_release_manifest.test.ts', 'Protects immutable preview release manifest data.', 'Preview artifacts can be mutable or contain sensitive values.', 'M1-02'),
  test('evidence.preview-preflight', 'release evidence and operator handoff checks', 'scripts/preview_release_preflight.test.ts', 'Protects explicit preview authorization categories.', 'Preview release actions can proceed without authorization.', 'M1-02'),
  test('evidence.preview-smoke-plan', 'release evidence and operator handoff checks', 'scripts/preview_smoke_plan.test.ts', 'Protects the manual preview smoke plan without executing it.', 'Required smoke coverage can be omitted from operator work.', 'M1-02'),
  test('evidence.preview-rollback-plan', 'release evidence and operator handoff checks', 'scripts/preview_rollback_plan.test.ts', 'Protects rollback planning and immutable artifact use.', 'Preview rollback cannot be executed safely.', 'M1-02'),
  test('evidence.preview-release-packet', 'release evidence and operator handoff checks', 'scripts/preview_release_packet.test.ts', 'Protects the complete preview release packet contract.', 'Release evidence categories can diverge or omit blockers.', 'M1-02'),
  test('evidence.staging-candidate', 'release evidence and operator handoff checks', 'scripts/staging_candidate_report.test.ts', 'Protects staging candidate reporting without deployment.', 'Candidate reports can overstate release readiness.', 'M1-02'),
  command('evidence.validate-local', 'release evidence and operator handoff checks', 'pnpm', ['evidence:validate'], 'Validates approved local evidence structure without generating or publishing it.', 'Existing release evidence is malformed or unsafe.', 'M1-02'),
]

export const DEFERRED_RELEASE_VALIDATIONS: DeferredReleaseValidation[] = [
  {
    id: 'browser-e2e',
    owner: 'M1-03',
    reason: 'Browser journeys, accessibility, responsive behavior, and direct-URL checks are explicitly deferred to M1-03.',
  },
  {
    id: 'support-request-migration-apply',
    owner: 'approved release migration process',
    reason: 'The support_requests migration remains unapplied and blocks production support operation.',
  },
  {
    id: 'live-provider-smoke',
    owner: 'operator evidence process',
    reason: 'Live Stripe and email-provider verification require separate credentials, authorization, and evidence.',
  },
  {
    id: 'deployment-and-production-smoke',
    owner: 'go-live operator',
    reason: 'Deployment, staging browser smoke, and production verification are not part of local non-browser validation.',
  },
]
