# Graph Report - /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp  (2026-06-14)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1121 nodes · 1866 edges · 158 communities (118 shown, 40 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b967ec59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Sponsored Claim Flow|Sponsored Claim Flow]]
- [[_COMMUNITY_User Provisioning|User Provisioning]]
- [[_COMMUNITY_Site Layout|Site Layout]]
- [[_COMMUNITY_Configuration Management|Configuration Management]]
- [[_COMMUNITY_External Dependencies|External Dependencies]]
- [[_COMMUNITY_Development Utilities|Development Utilities]]
- [[_COMMUNITY_Data Redaction|Data Redaction]]
- [[_COMMUNITY_Project Metadata|Project Metadata]]
- [[_COMMUNITY_Marketing Content|Marketing Content]]
- [[_COMMUNITY_Webhook Handling|Webhook Handling]]
- [[_COMMUNITY_Core Dependencies|Core Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Partner Session Management|Partner Session Management]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_CRM Sync Logic|CRM Sync Logic]]
- [[_COMMUNITY_Provisioning PHP Logic|Provisioning PHP Logic]]
- [[_COMMUNITY_Tailwind and Types|Tailwind and Types]]
- [[_COMMUNITY_Navigation Components|Navigation Components]]
- [[_COMMUNITY_Lint Configuration|Lint Configuration]]
- [[_COMMUNITY_Lint Rules|Lint Rules]]
- [[_COMMUNITY_Savings UI|Savings UI]]
- [[_COMMUNITY_Database Scripts|Database Scripts]]
- [[_COMMUNITY_Subscription Management|Subscription Management]]
- [[_COMMUNITY_Blog UI Components|Blog UI Components]]
- [[_COMMUNITY_Billing Portal Logic|Billing Portal Logic]]
- [[_COMMUNITY_Stripe Integration|Stripe Integration]]
- [[_COMMUNITY_Tenant Initialization|Tenant Initialization]]
- [[_COMMUNITY_Billing Portal Helpers|Billing Portal Helpers]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Deployment Scripts|Deployment Scripts]]
- [[_COMMUNITY_Tailwind Configuration|Tailwind Configuration]]
- [[_COMMUNITY_Webhook Testing|Webhook Testing]]
- [[_COMMUNITY_VIP Upgrade Flow|VIP Upgrade Flow]]
- [[_COMMUNITY_Billing Portal Flow|Billing Portal Flow]]
- [[_COMMUNITY_Blog Layout|Blog Layout]]
- [[_COMMUNITY_Bootcamp Page|Bootcamp Page]]
- [[_COMMUNITY_WordPress Data Types|WordPress Data Types]]
- [[_COMMUNITY_Documentation UI|Documentation UI]]
- [[_COMMUNITY_Partners Page|Partners Page]]
- [[_COMMUNITY_UI Form Components|UI Form Components]]
- [[_COMMUNITY_Database Cleanup|Database Cleanup]]
- [[_COMMUNITY_Migration Scripts|Migration Scripts]]
- [[_COMMUNITY_Partners Handoff Logic|Partners Handoff Logic]]
- [[_COMMUNITY_Customer Lookup|Customer Lookup]]
- [[_COMMUNITY_Migration Repair|Migration Repair]]
- [[_COMMUNITY_FAQ Components|FAQ Components]]
- [[_COMMUNITY_Tenant Cleanup|Tenant Cleanup]]
- [[_COMMUNITY_Webhook Diagnostics|Webhook Diagnostics]]
- [[_COMMUNITY_UI Dialog Components|UI Dialog Components]]
- [[_COMMUNITY_Nav Menu UI|Nav Menu UI]]
- [[_COMMUNITY_Affiliate Page|Affiliate Page]]
- [[_COMMUNITY_Smoke Checks|Smoke Checks]]
- [[_COMMUNITY_Sponsored Claim PHP|Sponsored Claim PHP]]
- [[_COMMUNITY_Package Metadata|Package Metadata]]
- [[_COMMUNITY_Claim Helpers|Claim Helpers]]
- [[_COMMUNITY_Decision Helpers|Decision Helpers]]
- [[_COMMUNITY_Env Bootstrapping|Env Bootstrapping]]
- [[_COMMUNITY_Thank You Page|Thank You Page]]
- [[_COMMUNITY_Environment Setup|Environment Setup]]
- [[_COMMUNITY_Upgrade Page|Upgrade Page]]
- [[_COMMUNITY_Signup API|Signup API]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Infrastructure Services|Infrastructure Services]]
- [[_COMMUNITY_Error UI|Error UI]]
- [[_COMMUNITY_Not Found Page|Not Found Page]]
- [[_COMMUNITY_Sitemap Generation|Sitemap Generation]]
- [[_COMMUNITY_Icons UI|Icons UI]]
- [[_COMMUNITY_Stripe Payments|Stripe Payments]]
- [[_COMMUNITY_Tailwind CSS|Tailwind CSS]]
- [[_COMMUNITY_Telegram Integration|Telegram Integration]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_WordPress Integration|WordPress Integration]]
- [[_COMMUNITY_YouTube Integration|YouTube Integration]]
- [[_COMMUNITY_Next Configuration|Next Configuration]]
- [[_COMMUNITY_Privacy Page|Privacy Page]]
- [[_COMMUNITY_Provisioning Script|Provisioning Script]]
- [[_COMMUNITY_Webhook Checks|Webhook Checks]]
- [[_COMMUNITY_Terms Page|Terms Page]]
- [[_COMMUNITY_Auth Session|Auth Session]]
- [[_COMMUNITY_Scenario Templates|Scenario Templates]]
- [[_COMMUNITY_Data Fetching|Data Fetching]]
- [[_COMMUNITY_GitHub Validation|GitHub Validation]]
- [[_COMMUNITY_ChatGPT Settings|ChatGPT Settings]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_Postgres Service|Postgres Service]]
- [[_COMMUNITY_Next Environment|Next Environment]]
- [[_COMMUNITY_Legacy Tailwind|Legacy Tailwind]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Old Tailwind|Old Tailwind]]
- [[_COMMUNITY_PostCSS Setup|PostCSS Setup]]
- [[_COMMUNITY_WordPress Sync|WordPress Sync]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]

## God Nodes (most connected - your core abstractions)
1. `redactEmail()` - 35 edges
2. `getStripe()` - 33 edges
3. `syncFromSubscription()` - 31 edges
4. `provisionFromCheckoutSession()` - 26 edges
5. `getStripeConfig()` - 22 edges
6. `getServerConfig()` - 21 edges
7. `handleStripeWebhook()` - 21 edges
8. `cn()` - 20 edges
9. `ProKit SaaS starter` - 15 edges
10. `describeBillingPortalReturnUrl()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Stripe (JPV Bootcamp Stripe Account) to WordPress Provisioning Documentation` --conceptually_related_to--> `WP_User`  [EXTRACTED]
  /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp/docs/STRIPE_WP_PROVISIONING.md → wordpress/mu-plugins/00-portal-entrypoint-and-fluentcrm-sync.php
- `run()` --calls--> `getStripeConfig()`  [EXTRACTED]
  scripts/stripe/check_price_products.ts → src/lib/stripe-config.ts
- `testRedaction()` --calls--> `redactEmail()`  [EXTRACTED]
  scripts/tests/billing_portal_helpers.ts → src/lib/log-redact.ts
- `testIdempotency()` --calls--> `hasProcessed()`  [INFERRED]
  scripts/tests/billing_portal_helpers.ts → src/lib/idempotency.ts
- `testIdempotency()` --calls--> `markProcessed()`  [INFERRED]
  scripts/tests/billing_portal_helpers.ts → src/lib/idempotency.ts

## Import Cycles
- None detected.

## Communities (158 total, 40 thin omitted)

### Community 0 - "Sponsored Claim Flow"
Cohesion: 0.22
Nodes (15): ALLOWED_STATUSES, EntitlementsError, EntitlementsResponse, extractBearerToken(), GET(), isEnvEnabled(), resolvePlanFromSubscriptions(), searchStripeCustomerIdByEmail() (+7 more)

### Community 1 - "User Provisioning"
Cohesion: 0.09
Nodes (51): ACTIVE_STATUSES, buildEmailSendKey(), buildWpActions(), EmailSendSource, EmailSource, evaluateEmailNotification(), findProvisioningRecord(), getCheckoutSessionLineItemInfo() (+43 more)

### Community 2 - "Site Layout"
Cohesion: 0.06
Nodes (58): ApprovePayload, parsePayload(), POST(), GET(), CheckoutPayload, POST(), ClaimOutcome, messageForOutcome() (+50 more)

### Community 3 - "Configuration Management"
Cohesion: 0.05
Nodes (26): font, metadata, RootLayout(), viewport, metadata, EmailFormProps, avatars, Providers() (+18 more)

### Community 4 - "External Dependencies"
Cohesion: 0.10
Nodes (38): EnvKey, getEnv(), getEnvAny(), getEnvBoolean(), getEnvOrDefault(), getOpsConfig(), getServerConfig(), getStripeConfig() (+30 more)

### Community 5 - "Development Utilities"
Cohesion: 0.08
Nodes (44): buildReturnUrl(), CustomerResolutionSource, extractBearerToken(), extractEmailDomain(), GET(), getStripeCustomerRecord(), handleBillingPortal(), isStripeCustomerMissing() (+36 more)

### Community 6 - "Data Redaction"
Cohesion: 0.05
Nodes (9): data, cards, data, types, data, data, Masonry, ResponsiveMasonry (+1 more)

### Community 7 - "Project Metadata"
Cohesion: 0.08
Nodes (39): AI Assistants and Automation, Clerk Authentication Service, Stripe Webhook Diagnostics Flag, ProKit AI usage guidelines document, ProKit SaaS Starter Template, ProKit Trustless Module Documentation, Stripe Webhook Testing Guide, Environment Variable Contracts (APP_SLUG, DATABASE_URL, etc.) (+31 more)

### Community 8 - "Marketing Content"
Cohesion: 0.16
Nodes (26): buildRedirect(), GET(), RedirectResult, hashSha256(), RedactedEmail, redactEmail(), formatPhoneForDisplay(), isValidInternationalPhone() (+18 more)

### Community 9 - "Webhook Handling"
Cohesion: 0.15
Nodes (19): logProvisioningDecision(), hashEmail(), upsertSponsoredSeatFromSession(), shouldSendMembershipEmailForEvent(), buildDebugInfo(), debugErrorPayload(), getBuildId(), getRequestPath() (+11 more)

### Community 10 - "Core Dependencies"
Cohesion: 0.09
Nodes (20): fs, loadEnvFile(), path, { spawnSync }, baseUrl, endpoints, headerVariants, redact() (+12 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.15
Nodes (23): Primary Webhook Endpoint, Stripe (JPV Bootcamp Stripe Account) to WordPress Provisioning Documentation, jpv_base_reason(), jpv_entitlements_base64url_encode(), jpv_entitlements_build_token(), jpv_entitlements_fetch_plan(), jpv_entitlements_get_secret(), jpv_entitlements_should_sync() (+15 more)

### Community 12 - "Partner Session Management"
Cohesion: 0.18
Nodes (18): buildSessionCookieOptions(), createPartnerSession(), PARTNERS_MAX_TOKEN_LENGTH, sanitizePartnersToken(), ALLOWED_HOSTS, normalizePath(), PARTNERS_DEFAULT_PATH, sanitizePathOnly() (+10 more)

### Community 13 - "TypeScript Configuration"
Cohesion: 0.18
Nodes (15): jpv_provisioning_extract_bearer_token(), jpv_provisioning_extract_name_data(), jpv_provisioning_find_header(), jpv_provisioning_get_app_sync_url(), jpv_provisioning_get_auth_header(), jpv_provisioning_get_param_value(), jpv_provisioning_get_token_sources(), jpv_provisioning_handle_request() (+7 more)

### Community 14 - "CRM Sync Logic"
Cohesion: 0.13
Nodes (11): nav_links, NavLink, PropsTypes, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader() (+3 more)

### Community 15 - "Provisioning PHP Logic"
Cohesion: 0.18
Nodes (11): data, itemProps, MoneyCardProps, SaveMoney(), cn(), Badge(), BadgeProps, badgeVariants (+3 more)

### Community 16 - "Tailwind and Types"
Cohesion: 0.16
Nodes (6): AuthorAvatarProps, BlogSpotlight(), faqData, post, posts, convertToReadableDate()

### Community 17 - "Navigation Components"
Cohesion: 0.27
Nodes (15): get_billing_portal_hmac_secret(), jpv_billing_portal_base64url_encode(), jpv_billing_portal_build_full_url(), jpv_billing_portal_build_token(), jpv_billing_portal_handle_go_endpoint(), jpv_billing_portal_handle_redirect(), jpv_billing_portal_has_unsafe_scheme(), jpv_billing_portal_log_missing_secret_once() (+7 more)

### Community 18 - "Lint Configuration"
Cohesion: 0.23
Nodes (13): crypto, generatePassword(), isAlphanumeric(), readPrismaSchemas(), { Client }, fail(), fs, loadEnvFile() (+5 more)

### Community 19 - "Lint Rules"
Cohesion: 0.24
Nodes (10): backup_schema(), clear_unfinished_migrations(), DATABASE_URL, detect_migrations(), on_error(), require_cmd(), restore_schema(), smoke_check() (+2 more)

### Community 20 - "Savings UI"
Cohesion: 0.17
Nodes (11): assert, expectStatus, fs, main(), path, payload, payloadString, sendWebhook() (+3 more)

### Community 21 - "Database Scripts"
Cohesion: 0.17
Nodes (3): data, nav_links1, nav_links2

### Community 22 - "Subscription Management"
Cohesion: 0.17
Nodes (10): bootcampHighlights, eventHighlights, exhibitorHighlights, impactPoints, metadata, navLinks, programPillars, speakerNotes (+2 more)

### Community 23 - "Blog UI Components"
Cohesion: 0.13
Nodes (15): Starting the ProKit application (npm run dev), Applying Prisma migrations for development environment, Database provisioning process (npm run db:init), ProKit Getting Started Guide, ProKit Infrastructure documentation, .env example template, .env configuration file, Troubleshooting instructions guide (+7 more)

### Community 25 - "Billing Portal Logic"
Cohesion: 0.33
Nodes (5): PageProps, getPartnersByCategory(), PartnerCategory, PartnerEntry, partners

### Community 26 - "Stripe Integration"
Cohesion: 0.27
Nodes (4): Button, ButtonProps, buttonVariants, Input

### Community 27 - "Tenant Initialization"
Cohesion: 0.31
Nodes (9): { Client }, columnExists(), fail(), fs, isSafeSchemaName(), loadEnvFile(), main(), path (+1 more)

### Community 28 - "Billing Portal Helpers"
Cohesion: 0.29
Nodes (9): { Client }, fs, listMigrationDirs(), loadEnvFile(), main(), path, readPrismaSchemas(), run() (+1 more)

### Community 29 - "Tailwind Config"
Cohesion: 0.26
Nodes (12): assertPrefix(), buildPrefix(), EnvKey, getEnv(), getPrefixes(), getStripeConfig(), getStripeWebhookSecrets(), normalizeStripeEnv() (+4 more)

### Community 30 - "Deployment Scripts"
Cohesion: 0.42
Nodes (8): jpv_partners_handoff_base64url_encode(), jpv_partners_handoff_build_token(), jpv_partners_handoff_get_secret(), jpv_partners_handoff_handle_request(), jpv_partners_handoff_log_event(), jpv_partners_handoff_random_nonce(), jpv_partners_handoff_redact_email(), jpv_partners_handoff_should_handle()

### Community 31 - "Tailwind Configuration"
Cohesion: 0.29
Nodes (6): { Client }, fs, loadEnvFile(), main(), path, { spawnSync }

### Community 32 - "Webhook Testing"
Cohesion: 0.43
Nodes (4): StaticData, AccordionContent, AccordionItem, AccordionTrigger

### Community 33 - "VIP Upgrade Flow"
Cohesion: 0.38
Nodes (6): fs, loadEnvFile(), path, { Client }, main(), parseArgs()

### Community 34 - "Billing Portal Flow"
Cohesion: 0.29
Nodes (5): { execSync }, fs, hasStripeCli, path, stripeEnv

### Community 35 - "Blog Layout"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 36 - "Bootcamp Page"
Cohesion: 0.29
Nodes (6): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle

### Community 37 - "WordPress Data Types"
Cohesion: 0.29
Nodes (6): NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 38 - "Documentation UI"
Cohesion: 0.33
Nodes (4): affiliateResources, affiliateSteps, faqItems, metadata

### Community 39 - "Partners Page"
Cohesion: 0.29
Nodes (11): buildReturnUrl(), extractBearerToken(), GET(), getActiveMembershipSubscriptionForCustomer(), getCurrentPlanFromSubscription(), getPriceIdForPlan(), getSubscriptionItemId(), isPricingPlanKey() (+3 more)

### Community 40 - "UI Form Components"
Cohesion: 0.60
Nodes (5): assert, checkCheckout(), checkThankYou(), fetchWithTimeout(), main()

### Community 41 - "Database Cleanup"
Cohesion: 0.26
Nodes (11): getTtlMs(), hasProcessed(), isPrismaUniqueError(), markProcessed(), MarkProcessedResult, memoryStore, prismaClient, PrismaClientLike (+3 more)

### Community 42 - "Migration Scripts"
Cohesion: 0.60
Nodes (5): jpv_sponsored_claim_base64url_decode(), jpv_sponsored_claim_get_env(), jpv_sponsored_claim_handle(), jpv_sponsored_claim_no_cache(), jpv_sponsored_claim_verify_token()

### Community 43 - "Partners Handoff Logic"
Cohesion: 0.73
Nodes (5): basePayload(), run(), testTamperFails(), testTokenRoundTrip(), testUrlEncodingSurvives()

### Community 44 - "Customer Lookup"
Cohesion: 0.73
Nodes (5): basePayload(), run(), testTamperFails(), testTokenRoundTrip(), testUrlEncodingSurvives()

### Community 45 - "Migration Repair"
Cohesion: 0.33
Nodes (11): Tenant Database Connection URL, Development Runtime Environment, Dokploy Deployment System, ProKit Infrastructure Guide, MCP Bridge Wrapper, Postgres Database, Prisma ORM/Migration Tool, Production Provisioning Process (+3 more)

### Community 46 - "FAQ Components"
Cohesion: 0.40
Nodes (4): content, envPath, fs, path

### Community 48 - "Webhook Diagnostics"
Cohesion: 0.40
Nodes (3): metadata, upgradeSteps, vipBenefits

### Community 51 - "Nav Menu UI"
Cohesion: 0.22
Nodes (10): customer.subscription.updated event, Deduplication fields stored in tenant_jpvbootcamp.customer_provisioning, Membership email from Resend (support@jpvbootcamp.com or configured sender), Newsletter email, Explicit configuration ID for portal sessions (test/live), Stripe environment (test or live) selection, tenant_jpvbootcamp.customer_provisioning database table, Pro to VIP upgrade test flow (+2 more)

### Community 52 - "Affiliate Page"
Cohesion: 0.53
Nodes (6): Per-tenant Database Schema and Registry, Tenant Cleanup Script, Tenant Provisioning Script, ProKit Database Guide, External Automation Bridge RPC Layer, Prisma Schema Definition

### Community 53 - "Smoke Checks"
Cohesion: 0.50
Nodes (4): MySQL Database Service, WordPress Service, Build and Deploy Job, Dokploy API

### Community 54 - "Sponsored Claim PHP"
Cohesion: 0.60
Nodes (6): Environment variables for plan resolution and provisioning, Plan resolution logic (Price ID -> Product ID -> Metadata), Stripe Portal settings requirements (Subscription management, Proration), Pro Stripe product, Relevant URLs and API endpoints for the portal, VIP Stripe product

### Community 56 - "Claim Helpers"
Cohesion: 0.67
Nodes (3): DecisionResult, getMessage(), SponsoredDecisionPage()

### Community 57 - "Decision Helpers"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

### Community 81 - "Icons UI"
Cohesion: 0.40
Nodes (3): isSponsoredSeatSession(), PageProps, SponsoredThankYouPage()

### Community 118 - "Stripe Payments"
Cohesion: 0.40
Nodes (5): Full Database Model and Lifecycle Reference, npm run db:cleanup command, Preview Tenants (type = 'preview'), Production Tenants (type = 'prod'), PROKIT Tenant Cleanup Implementation Reference

### Community 127 - "WordPress Integration"
Cohesion: 0.67
Nodes (4): Tenant-scoped Runtime Connection URL, Development Environment Setup, Production Environment Setup, Admin Connection for Infra Scripts

### Community 128 - "YouTube Integration"
Cohesion: 0.50
Nodes (4): Script to Run Production Migrations, Script to Discover MCP Endpoint and Auth Header, Script for Tenant Provisioning, Process of provisioning a tenant for a given slug

### Community 129 - "Next Configuration"
Cohesion: 0.67
Nodes (4): Git Workflow Guide, Dokploy CI/CD System, Feature Branch, Main Branch

## Knowledge Gaps
- **281 isolated node(s):** `{ Client }`, `fs`, `path`, `{ Client }`, `fs` (+276 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Provisioning PHP Logic` to `Webhook Testing`, `Blog Layout`, `Bootcamp Page`, `WordPress Data Types`, `CRM Sync Logic`, `Decision Helpers`, `Stripe Integration`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getStripe()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`getStripe()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ Client }`, `fs`, `path` to the rest of the system?**
  _281 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `User Provisioning` be split into smaller, more focused modules?**
  _Cohesion score 0.0880503144654088 - nodes in this community are weakly interconnected._
- **Should `Site Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.0627027027027027 - nodes in this community are weakly interconnected._
- **Should `Configuration Management` be split into smaller, more focused modules?**
  _Cohesion score 0.052244897959183675 - nodes in this community are weakly interconnected._
- **Should `External Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09936575052854123 - nodes in this community are weakly interconnected._