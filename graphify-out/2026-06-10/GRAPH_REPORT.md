# Graph Report - /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp  (2026-06-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1308 nodes · 2041 edges · 151 communities (127 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.82)
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
- [[_COMMUNITY_Stripe Configuration|Stripe Configuration]]
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
- [[_COMMUNITY_UI Card Components|UI Card Components]]
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
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Infrastructure Services|Infrastructure Services]]
- [[_COMMUNITY_Asset Syncing|Asset Syncing]]
- [[_COMMUNITY_Decision Page|Decision Page]]
- [[_COMMUNITY_Tenant Maintenance|Tenant Maintenance]]
- [[_COMMUNITY_Avatar Components|Avatar Components]]
- [[_COMMUNITY_Auth Route|Auth Route]]
- [[_COMMUNITY_Testimonial Avatars|Testimonial Avatars]]
- [[_COMMUNITY_Provisioning Tests|Provisioning Tests]]
- [[_COMMUNITY_Blog UI|Blog UI]]
- [[_COMMUNITY_Env Checks|Env Checks]]
- [[_COMMUNITY_Portal Smoke|Portal Smoke]]
- [[_COMMUNITY_Webhook Verification|Webhook Verification]]
- [[_COMMUNITY_Success Page|Success Page]]
- [[_COMMUNITY_Verification Script|Verification Script]]
- [[_COMMUNITY_Local Start|Local Start]]
- [[_COMMUNITY_Local Stop|Local Stop]]
- [[_COMMUNITY_Next Configuration|Next Configuration]]
- [[_COMMUNITY_Provisioning Script|Provisioning Script]]
- [[_COMMUNITY_Webhook Checks|Webhook Checks]]
- [[_COMMUNITY_Auth Session|Auth Session]]
- [[_COMMUNITY_Scenario Templates|Scenario Templates]]
- [[_COMMUNITY_ChatGPT Settings|ChatGPT Settings]]
- [[_COMMUNITY_Postgres Service|Postgres Service]]
- [[_COMMUNITY_MySQL Sync|MySQL Sync]]
- [[_COMMUNITY_Postgres Sync|Postgres Sync]]
- [[_COMMUNITY_WordPress Sync|WordPress Sync]]

## God Nodes (most connected - your core abstractions)
1. `redactEmail()` - 35 edges
2. `getStripe()` - 33 edges
3. `syncFromSubscription()` - 31 edges
4. `provisionFromCheckoutSession()` - 26 edges
5. `getStripeConfig()` - 22 edges
6. `compilerOptions` - 21 edges
7. `getServerConfig()` - 21 edges
8. `handleStripeWebhook()` - 21 edges
9. `cn()` - 20 edges
10. `compilerOptions` - 19 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `getStripeConfig()`  [EXTRACTED]
  scripts/stripe/check_price_products.ts → src/lib/stripe-config.ts
- `testRedaction()` --calls--> `redactEmail()`  [EXTRACTED]
  scripts/tests/billing_portal_helpers.ts → src/lib/log-redact.ts
- `testIdempotency()` --calls--> `hasProcessed()`  [INFERRED]
  scripts/tests/billing_portal_helpers.ts → src/lib/idempotency.ts
- `testIdempotency()` --calls--> `markProcessed()`  [INFERRED]
  scripts/tests/billing_portal_helpers.ts → src/lib/idempotency.ts
- `Build and Deploy Job` --conceptually_related_to--> `WordPress Service`  [INFERRED]
  .github/workflows/deploy.yml → docker-compose.yml

## Import Cycles
- None detected.

## Communities (151 total, 24 thin omitted)

### Community 0 - "Sponsored Claim Flow"
Cohesion: 0.06
Nodes (59): ApprovePayload, parsePayload(), POST(), GET(), CheckoutPayload, POST(), ClaimOutcome, messageForOutcome() (+51 more)

### Community 1 - "User Provisioning"
Cohesion: 0.08
Nodes (50): ACTIVE_STATUSES, buildEmailSendKey(), buildWpActions(), EmailSendSource, EmailSource, evaluateEmailNotification(), findProvisioningRecord(), getCheckoutSessionLineItemInfo() (+42 more)

### Community 2 - "Site Layout"
Cohesion: 0.05
Nodes (20): font, metadata, RootLayout(), viewport, metadata, EmailFormProps, avatars, Providers() (+12 more)

### Community 3 - "Configuration Management"
Cohesion: 0.09
Nodes (41): EnvKey, getEnv(), getEnvAny(), getEnvBoolean(), getEnvOrDefault(), getOpsConfig(), getServerConfig(), getStripeConfig() (+33 more)

### Community 4 - "External Dependencies"
Cohesion: 0.04
Nodes (49): dependencies, axios, class-variance-authority, @clerk/nextjs, clsx, form-data, formik, @headlessui/react (+41 more)

### Community 5 - "Development Utilities"
Cohesion: 0.08
Nodes (28): fs, loadEnvFile(), path, { spawnSync }, baseUrl, endpoints, headerVariants, redact() (+20 more)

### Community 6 - "Data Redaction"
Cohesion: 0.15
Nodes (27): buildRedirect(), GET(), RedirectResult, hashSha256(), RedactedEmail, redactEmail(), formatPhoneForDisplay(), isValidInternationalPhone() (+19 more)

### Community 7 - "Project Metadata"
Cohesion: 0.06
Nodes (35): author, description, devDependencies, autoprefixer, daisyui, eslint, eslint-config-next, husky (+27 more)

### Community 8 - "Marketing Content"
Cohesion: 0.06
Nodes (8): data, cards, data, types, data, data, Masonry, ResponsiveMasonry

### Community 9 - "Webhook Handling"
Cohesion: 0.11
Nodes (29): getTtlMs(), hasProcessed(), isPrismaUniqueError(), markProcessed(), MarkProcessedResult, memoryStore, prismaClient, PrismaClientLike (+21 more)

### Community 10 - "Core Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, class-variance-authority, clsx, formik, @headlessui/react, lucide-react, newrelic, next (+21 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, incremental, isolatedModules (+16 more)

### Community 12 - "Partner Session Management"
Cohesion: 0.18
Nodes (18): buildSessionCookieOptions(), createPartnerSession(), PARTNERS_MAX_TOKEN_LENGTH, sanitizePartnersToken(), ALLOWED_HOSTS, normalizePath(), PARTNERS_DEFAULT_PATH, sanitizePathOnly() (+10 more)

### Community 13 - "TypeScript Configuration"
Cohesion: 0.09
Nodes (22): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, incremental, isolatedModules, jsx (+14 more)

### Community 14 - "CRM Sync Logic"
Cohesion: 0.17
Nodes (21): jpv_base_reason(), jpv_entitlements_base64url_encode(), jpv_entitlements_build_token(), jpv_entitlements_fetch_plan(), jpv_entitlements_get_secret(), jpv_entitlements_should_sync(), jpv_entitlements_sync_on_login(), jpv_entitlements_sync_user() (+13 more)

### Community 15 - "Provisioning PHP Logic"
Cohesion: 0.18
Nodes (15): jpv_provisioning_extract_bearer_token(), jpv_provisioning_extract_name_data(), jpv_provisioning_find_header(), jpv_provisioning_get_app_sync_url(), jpv_provisioning_get_auth_header(), jpv_provisioning_get_param_value(), jpv_provisioning_get_token_sources(), jpv_provisioning_handle_request() (+7 more)

### Community 16 - "Tailwind and Types"
Cohesion: 0.10
Nodes (20): tailwindcss-animate, devDependencies, autoprefixer, daisyui, eslint-config-next, husky, postcss, tailwindcss (+12 more)

### Community 17 - "Navigation Components"
Cohesion: 0.13
Nodes (11): nav_links, NavLink, PropsTypes, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader() (+3 more)

### Community 18 - "Lint Configuration"
Cohesion: 0.11
Nodes (18): env, browser, es6, node, extends, parser, plugins, rules (+10 more)

### Community 19 - "Lint Rules"
Cohesion: 0.11
Nodes (18): env, browser, es6, node, extends, parser, plugins, rules (+10 more)

### Community 20 - "Savings UI"
Cohesion: 0.18
Nodes (11): data, itemProps, MoneyCardProps, SaveMoney(), cn(), Badge(), BadgeProps, badgeVariants (+3 more)

### Community 21 - "Database Scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:cleanup, db:cleanup:public, db:dedupe:check, db:init, db:migrate:dev, db:migrate:prod (+10 more)

### Community 22 - "Subscription Management"
Cohesion: 0.23
Nodes (15): buildReturnUrl(), extractBearerToken(), GET(), getActiveMembershipSubscriptionForCustomer(), getCurrentPlanFromSubscription(), getPriceIdForPlan(), getSubscriptionItemId(), isPricingPlanKey() (+7 more)

### Community 23 - "Blog UI Components"
Cohesion: 0.16
Nodes (6): AuthorAvatarProps, BlogSpotlight(), faqData, post, posts, convertToReadableDate()

### Community 24 - "Stripe Configuration"
Cohesion: 0.21
Nodes (15): assertPrefix(), buildPrefix(), EnvKey, getEnv(), getPrefixes(), getStripeConfig(), getStripeEnv(), getStripeWebhookSecrets() (+7 more)

### Community 25 - "Billing Portal Logic"
Cohesion: 0.27
Nodes (15): get_billing_portal_hmac_secret(), jpv_billing_portal_base64url_encode(), jpv_billing_portal_build_full_url(), jpv_billing_portal_build_token(), jpv_billing_portal_handle_go_endpoint(), jpv_billing_portal_handle_redirect(), jpv_billing_portal_has_unsafe_scheme(), jpv_billing_portal_log_missing_secret_once() (+7 more)

### Community 26 - "Stripe Integration"
Cohesion: 0.22
Nodes (12): ALLOWED_STATUSES, EntitlementsError, EntitlementsResponse, extractBearerToken(), GET(), isEnvEnabled(), resolvePlanFromSubscriptions(), searchStripeCustomerIdByEmail() (+4 more)

### Community 27 - "Tenant Initialization"
Cohesion: 0.23
Nodes (13): crypto, generatePassword(), isAlphanumeric(), readPrismaSchemas(), { Client }, fail(), fs, loadEnvFile() (+5 more)

### Community 28 - "Billing Portal Helpers"
Cohesion: 0.23
Nodes (13): ALLOWED_RETURN_ORIGINS, BILLING_PORTAL_DEFAULT_RETURN_URL, BillingPortalReturnInfo, describeBillingPortalReturnUrl(), resolveBillingPortalReturnUrl(), safeDecodeURIComponent(), stripChainedUrl(), stripCrLf() (+5 more)

### Community 29 - "Tailwind Config"
Cohesion: 0.14
Nodes (13): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+5 more)

### Community 30 - "Deployment Scripts"
Cohesion: 0.24
Nodes (10): backup_schema(), clear_unfinished_migrations(), DATABASE_URL, detect_migrations(), on_error(), require_cmd(), restore_schema(), smoke_check() (+2 more)

### Community 31 - "Tailwind Configuration"
Cohesion: 0.14
Nodes (13): aliases, components, utils, rsc, $schema, style, tailwind, baseColor (+5 more)

### Community 32 - "Webhook Testing"
Cohesion: 0.17
Nodes (11): assert, expectStatus, fs, main(), path, payload, payloadString, sendWebhook() (+3 more)

### Community 33 - "VIP Upgrade Flow"
Cohesion: 0.28
Nodes (12): buildReturnUrl(), CustomerResolutionSource, extractBearerToken(), extractEmailDomain(), GET(), getStripeCustomerRecord(), handleUpgradeVip(), isStripeCustomerMissing() (+4 more)

### Community 34 - "Billing Portal Flow"
Cohesion: 0.30
Nodes (11): buildReturnUrl(), CustomerResolutionSource, extractBearerToken(), extractEmailDomain(), GET(), getStripeCustomerRecord(), handleBillingPortal(), isStripeCustomerMissing() (+3 more)

### Community 35 - "Blog Layout"
Cohesion: 0.17
Nodes (3): data, nav_links1, nav_links2

### Community 36 - "Bootcamp Page"
Cohesion: 0.17
Nodes (10): bootcampHighlights, eventHighlights, exhibitorHighlights, impactPoints, metadata, navLinks, programPillars, speakerNotes (+2 more)

### Community 37 - "WordPress Data Types"
Cohesion: 0.18
Nodes (11): Cury, Link, Links, OgImage, SchemaGraph, VersionHistory, WPDetailedPost, WPPost (+3 more)

### Community 39 - "Partners Page"
Cohesion: 0.33
Nodes (5): PageProps, getPartnersByCategory(), PartnerCategory, PartnerEntry, partners

### Community 40 - "UI Form Components"
Cohesion: 0.27
Nodes (4): Button, ButtonProps, buttonVariants, Input

### Community 41 - "Database Cleanup"
Cohesion: 0.31
Nodes (9): { Client }, columnExists(), fail(), fs, isSafeSchemaName(), loadEnvFile(), main(), path (+1 more)

### Community 42 - "Migration Scripts"
Cohesion: 0.29
Nodes (9): { Client }, fs, listMigrationDirs(), loadEnvFile(), main(), path, readPrismaSchemas(), run() (+1 more)

### Community 43 - "Partners Handoff Logic"
Cohesion: 0.42
Nodes (8): jpv_partners_handoff_base64url_encode(), jpv_partners_handoff_build_token(), jpv_partners_handoff_get_secret(), jpv_partners_handoff_handle_request(), jpv_partners_handoff_log_event(), jpv_partners_handoff_random_nonce(), jpv_partners_handoff_redact_email(), jpv_partners_handoff_should_handle()

### Community 44 - "Customer Lookup"
Cohesion: 0.44
Nodes (8): extractEmailDomain(), GET(), getStripeCustomerIdByEmail(), isEnvEnabled(), logFailure(), logSuccess(), plainError(), searchStripeCustomerIdByEmail()

### Community 45 - "Migration Repair"
Cohesion: 0.29
Nodes (6): { Client }, fs, loadEnvFile(), main(), path, { spawnSync }

### Community 46 - "FAQ Components"
Cohesion: 0.43
Nodes (4): StaticData, AccordionContent, AccordionItem, AccordionTrigger

### Community 47 - "Tenant Cleanup"
Cohesion: 0.38
Nodes (6): fs, loadEnvFile(), path, { Client }, main(), parseArgs()

### Community 48 - "Webhook Diagnostics"
Cohesion: 0.29
Nodes (5): { execSync }, fs, hasStripeCli, path, stripeEnv

### Community 49 - "UI Card Components"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 50 - "UI Dialog Components"
Cohesion: 0.29
Nodes (6): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle

### Community 51 - "Nav Menu UI"
Cohesion: 0.29
Nodes (6): NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 52 - "Affiliate Page"
Cohesion: 0.33
Nodes (4): affiliateResources, affiliateSteps, faqItems, metadata

### Community 53 - "Smoke Checks"
Cohesion: 0.60
Nodes (5): assert, checkCheckout(), checkThankYou(), fetchWithTimeout(), main()

### Community 54 - "Sponsored Claim PHP"
Cohesion: 0.60
Nodes (5): jpv_sponsored_claim_base64url_decode(), jpv_sponsored_claim_get_env(), jpv_sponsored_claim_handle(), jpv_sponsored_claim_no_cache(), jpv_sponsored_claim_verify_token()

### Community 55 - "Package Metadata"
Cohesion: 0.33
Nodes (5): name, prisma, schema, private, version

### Community 56 - "Claim Helpers"
Cohesion: 0.73
Nodes (5): basePayload(), run(), testTamperFails(), testTokenRoundTrip(), testUrlEncodingSurvives()

### Community 57 - "Decision Helpers"
Cohesion: 0.73
Nodes (5): basePayload(), run(), testTamperFails(), testTokenRoundTrip(), testUrlEncodingSurvives()

### Community 58 - "Env Bootstrapping"
Cohesion: 0.40
Nodes (4): content, envPath, fs, path

### Community 60 - "Environment Setup"
Cohesion: 0.40
Nodes (4): content, envPath, fs, path

### Community 61 - "Upgrade Page"
Cohesion: 0.40
Nodes (3): metadata, upgradeSteps, vipBenefits

### Community 64 - "Infrastructure Services"
Cohesion: 0.50
Nodes (4): MySQL Database Service, WordPress Service, Build and Deploy Job, Dokploy API

### Community 66 - "Decision Page"
Cohesion: 0.67
Nodes (3): DecisionResult, getMessage(), SponsoredDecisionPage()

### Community 67 - "Tenant Maintenance"
Cohesion: 0.67
Nodes (3): { Client }, main(), parseArgs()

### Community 68 - "Avatar Components"
Cohesion: 0.50
Nodes (3): Avatar, AvatarFallback, AvatarImage

## Knowledge Gaps
- **474 isolated node(s):** `extends`, `browser`, `node`, `es6`, `parser` (+469 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `External Dependencies` to `Webhook Handling`, `Project Metadata`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `prismaClient` connect `Webhook Handling` to `External Dependencies`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getStripe()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`getStripe()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `extends`, `browser`, `node` to the rest of the system?**
  _474 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Sponsored Claim Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.062456140350877196 - nodes in this community are weakly interconnected._
- **Should `User Provisioning` be split into smaller, more focused modules?**
  _Cohesion score 0.08282828282828283 - nodes in this community are weakly interconnected._
- **Should `Site Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.05357142857142857 - nodes in this community are weakly interconnected._