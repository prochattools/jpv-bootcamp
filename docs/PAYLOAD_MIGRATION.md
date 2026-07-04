# WordPress → Payload CMS Migration Guide

**Purpose**: This document describes how to migrate content from WordPress (with FluentCommunity) to Payload CMS at `jpvbootcamp.com`. It is the reference for the migration project. Read it completely before starting any migration work.

**Restore point before starting**: `restore/payload-baseline` (tag on `main`)
**Migration work branch**: create `feature/payload-migration` from `main`

**Required reading before this document**: `docs/ARCHITECTURE.md` — maps every system, integration, and data flow in the current production application. The migration described here is a content-only operation; all Stripe, WordPress provisioning, FluentCRM, and billing infrastructure remains untouched throughout.

**Course/community replacement note**: full replacement of FluentCommunity, FluentCRM, member accounts, entitlements, billing access, course progress, groups, chat, and transactional email is covered by `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md`. Do not use this content migration guide as authorization to migrate or replace those systems.

---

## Overview

The source systems are:
- **WordPress** at `https://portal.jpvbootcamp.com` — posts, pages, course content, media
- **FluentCommunity** (WordPress plugin) — community posts, member content, groups

The target system is:
- **Payload CMS** at `https://jpvbootcamp.com/app` — running on `restore/payload-baseline`

The migration is **not a lift-and-shift**. WordPress HTML content does not map directly to Payload's Lexical rich text format. Each content type must be mapped explicitly.

---

## Tech stack involved in the migration

### Source: WordPress + FluentCommunity

| Component | Tech | Access |
|-----------|------|--------|
| WordPress CMS | PHP + MySQL | WP admin, WP REST API, WP CLI, direct DB |
| FluentCommunity | WordPress plugin | Plugin REST API, WP DB tables |
| WordPress database | MySQL (separate from Supabase) | Direct DB access or WP CLI |
| Media files | Files on WP server | SFTP / WP media library |
| WordPress REST API | `https://portal.jpvbootcamp.com/wp-json/wp/v2/` | Unauthenticated (public) or with app password |

### Target: Payload CMS

| Component | Tech | Access |
|-----------|------|--------|
| Payload CMS | TypeScript / Node.js | Admin UI at `/app`, Local API, REST API |
| Payload REST API | JSON over HTTP | `https://jpvbootcamp.com/api/<collection>` |
| Payload Local API | Direct in-process function call | Node.js scripts only — fastest, no HTTP |
| Database | PostgreSQL 15 (Supabase on Azure) | Via `DATABASE_URL` inside Dokploy VNet only |
| Media storage | Local filesystem → `public/media/` | Via Payload upload API |

### Migration tooling

| Tool | Purpose |
|------|---------|
| Node.js scripts (TypeScript via `tsx`) | Import scripts that call Payload Local API |
| `@payloadcms/db-postgres` Local API | `payload.create()`, `payload.find()`, etc. |
| WordPress REST API (`/wp-json/wp/v2/`) | Export posts, pages, categories, media from WordPress |
| `node-html-parser` or `unified`/`remark` | Convert WordPress HTML to Payload Lexical JSON |
| `tsx` | Run TypeScript scripts without compiling |

---

## How Payload CMS works

Understanding this is required before writing any migration script.

### Collections are the content model

Everything in Payload is a **collection** — a named set of records with a defined schema. The collections in this app are:

| Collection slug | Purpose | Fields |
|-----------------|---------|--------|
| `payload_categories` | Taxonomy | `title` |
| `payload_posts` | Blog posts / articles | `title`, `slug`, `content` (Lexical), `status`, `categories` |
| `payload_pages` | Static pages | `title`, `slug`, `content` (Lexical) |
| `payload_media` | Images and files | `alt`, `filename`, `url`, `width`, `height`, `mimeType` |
| `payload_users` | CMS admin users | `email`, `password` (auth collection) |

### The Lexical rich text format

Payload uses **Lexical** (Meta's open-source text editor) for rich text fields. This is the most important thing to understand about the migration.

**WordPress stores content as HTML.** Payload stores content as **Lexical JSON** — a structured tree of nodes.

A Lexical document looks like this:

```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Hello world",
            "format": 0
          }
        ],
        "version": 1
      },
      {
        "type": "heading",
        "tag": "h2",
        "children": [
          {
            "type": "text",
            "text": "Section title",
            "format": 0
          }
        ],
        "version": 1
      }
    ],
    "direction": "ltr",
    "format": "",
    "indent": 0,
    "version": 1
  }
}
```

**Text format flags** (bitmask on `format` field):
- `0` = plain
- `1` = bold
- `2` = italic
- `4` = strikethrough
- `8` = underline
- `16` = code (inline)
- `32` = subscript
- `64` = superscript

**Node types available in Lexical:**
- `paragraph` — standard paragraph
- `heading` — with `tag`: `h1` through `h6`
- `list` — with `listType`: `bullet` or `number`
- `listitem` — child of list
- `quote` — blockquote
- `code` — fenced code block (with `language`)
- `link` — with `fields.url` and `fields.newTab`
- `upload` — references a `payload_media` record by `id`
- `horizontalrule` — `<hr>`

**Every node must include `version: 1`.**

### How to write records with the Local API

The **Local API** is a direct in-process call — no HTTP, no authentication — the fastest and most reliable way to import data. It is only available inside Node.js scripts that import `payload.config.ts`.

```ts
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })

// Create a category
const category = await payload.create({
  collection: 'payload_categories',
  data: { title: 'Coaching' },
})

// Create a post
const post = await payload.create({
  collection: 'payload_posts',
  data: {
    title: 'My first post',
    slug: 'my-first-post',
    status: 'published',
    content: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [{ type: 'text', text: 'Body text here.', format: 0, version: 1 }],
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    },
    categories: [category.id],  // relationship by ID
  },
})

// Upload media
const fs = require('fs')
const file = {
  data: fs.readFileSync('/path/to/image.jpg'),
  mimetype: 'image/jpeg',
  name: 'image.jpg',
  size: fs.statSync('/path/to/image.jpg').size,
}
const media = await payload.create({
  collection: 'payload_media',
  data: { alt: 'Description of image' },
  file,
})
```

### How relationships work

Relationships in Payload are stored by `id` (integer). When you create a post with categories, you pass the category IDs:

```ts
categories: [1, 2, 3]  // array of payload_categories.id values
```

This means categories must be created before posts. The migration must be run in dependency order:
1. Categories first
2. Media (images used in post content)
3. Posts and pages last (they reference categories and media)

### Slugs and uniqueness

The `slug` field on posts and pages is marked `unique: true`. If two WordPress posts have the same slug, the second import will fail. The migration script must handle duplicates — either skip, append a suffix, or prompt.

### The `status` field on posts

Posts have `status: 'draft' | 'published'`. Importing with `status: 'published'` makes the post immediately visible via the REST API and admin. Use `'draft'` for content that needs review before going live.

---

## What WordPress exposes for migration

### WordPress REST API endpoints

All public content is available without authentication at:

```
GET https://portal.jpvbootcamp.com/wp-json/wp/v2/posts?per_page=100&page=1
GET https://portal.jpvbootcamp.com/wp-json/wp/v2/pages?per_page=100&page=1
GET https://portal.jpvbootcamp.com/wp-json/wp/v2/categories?per_page=100
GET https://portal.jpvbootcamp.com/wp-json/wp/v2/media?per_page=100&page=1
GET https://portal.jpvbootcamp.com/wp-json/wp/v2/tags?per_page=100
```

Pagination: responses include `X-WP-Total` and `X-WP-TotalPages` headers. Loop `?page=1`, `?page=2`, etc. until the page count is exhausted.

---

## Preview migration inventory

The reviewed Payload migration inventory used for preview readiness is unified in code and in release policy. The canonical ordered list is:

1. `20260620_213328`
2. `20260621_194424_course_system_phase1`
3. `20260622_093852_course_private_media`
4. `20260627_010700_structured_community_attachments`
5. `20260630_100730_affiliate_reporting`
6. `20260630_190000_payload_preferences_id_constraint`
7. `20260701_201500_member_email_verification`
8. `20260702_001500_member_account_action_purposes`
9. `20260703_000000_partner_affiliate_operations`
10. `20260704_090000_partner_schema_reconciliation`

This inventory is a repository-only contract for ordering, validation, and preview planning. It does not imply that any migration has been executed, applied, or approved for live rollout.

### What a WordPress post looks like

```json
{
  "id": 123,
  "date": "2024-03-15T10:00:00",
  "slug": "my-post-slug",
  "status": "publish",
  "title": { "rendered": "My Post Title" },
  "content": { "rendered": "<p>HTML content here...</p>", "protected": false },
  "excerpt": { "rendered": "<p>Short summary...</p>" },
  "author": 1,
  "featured_media": 456,
  "categories": [2, 5],
  "tags": [8, 12]
}
```

Key mapping:
- `title.rendered` → `title`
- `slug` → `slug` (check uniqueness)
- `content.rendered` → `content` (requires HTML → Lexical conversion)
- `status` `"publish"` → `"published"`, any other status → `"draft"`
- `categories` → array of Payload category IDs (requires ID mapping)
- `featured_media` → Payload media ID (requires downloading and importing the image first)

### What a WordPress category looks like

```json
{
  "id": 2,
  "name": "Coaching",
  "slug": "coaching",
  "description": "",
  "count": 14
}
```

Map `name` → `title` in Payload. Keep a `wpId → payloadId` map during migration.

### What a WordPress media item looks like

```json
{
  "id": 456,
  "source_url": "https://portal.jpvbootcamp.com/wp-content/uploads/2024/03/image.jpg",
  "alt_text": "Image description",
  "mime_type": "image/jpeg",
  "media_details": {
    "width": 1200,
    "height": 630
  }
}
```

Migration requires downloading the file from `source_url`, then uploading it to Payload via the Local API `file` parameter.

### FluentCommunity content

FluentCommunity does not expose a standard REST API. Content must be extracted via:
1. **WP CLI** on the server: `wp fluent_community_posts list --format=json`
2. **Direct database query** against the WordPress MySQL database
3. **Custom WP plugin endpoint** registered temporarily during migration

FluentCommunity content structure depends on the plugin version. Assess the content volume and structure before migrating — community posts may not map to `payload_posts` and may need a new collection.

---

## HTML → Lexical conversion

This is the hardest part of the migration. WordPress content is HTML; Payload requires Lexical JSON.

### Approach

Use a purpose-built conversion library. The recommended approach:

```
HTML string
  → parse with node-html-parser or cheerio
  → walk DOM tree
  → emit Lexical node objects
  → wrap in { root: { type: 'root', children: [...], version: 1 } }
```

### Element mapping

| HTML element | Lexical node type | Notes |
|-------------|------------------|-------|
| `<p>` | `paragraph` | Most common |
| `<h1>` through `<h6>` | `heading` with `tag: "h1"` etc. | |
| `<ul>` | `list` with `listType: "bullet"` | Children are `listitem` |
| `<ol>` | `list` with `listType: "number"` | Children are `listitem` |
| `<li>` | `listitem` | |
| `<blockquote>` | `quote` | |
| `<pre>` / `<code>` (block) | `code` with `language` | |
| `<a href="...">` | `link` with `fields.url` | |
| `<img src="...">` | `upload` | Requires image to be in `payload_media` first |
| `<strong>` / `<b>` | text node with `format: 1` (bold) | |
| `<em>` / `<i>` | text node with `format: 2` (italic) | |
| `<code>` (inline) | text node with `format: 16` | |
| `<br>` | linebreak node or split paragraph | |
| `<hr>` | `horizontalrule` | |

### What to do with elements that have no Lexical equivalent

WordPress content often contains:
- **Shortcodes** (`[gallery]`, `[caption]`, custom plugin codes) — strip them or convert to a plain paragraph noting what was there
- **Embedded iframes** (YouTube, Vimeo) — Lexical has no built-in iframe node; either strip them, store the URL as a link, or add a custom `embed` node to the Payload collection (requires schema change)
- **WordPress block editor JSON** (`<!-- wp:paragraph -->` comments) — strip these HTML comments, process only the rendered HTML between them
- **Tables** (`<table>`) — Lexical has no default table node at baseline; either strip or add a custom node
- **Raw HTML widgets** — strip or convert to a code block

**The safest approach**: strip unknown elements, log what was stripped, and review manually after import.

### Practical approach for this migration

Write a converter function that handles the common cases and logs everything it drops. Run it against a sample of 10 posts first. Review the output in the Payload admin. Fix the converter. Then run the full import.

---

## Migration boundaries and limitations

### What CAN be migrated automatically

- Posts with titles, slugs, standard HTML content, categories, publish status, and dates
- Pages with titles, slugs, and standard HTML content
- Categories and tags
- Media files (images, PDFs) — requires downloading and re-uploading
- Author names as plain text (Payload users are separate from WP users)

### What CANNOT be migrated automatically

| WordPress feature | Limitation |
|-------------------|-----------|
| WP user accounts | Payload users are a separate system. WP member accounts are not migrated to `payload_users`. |
| Membership levels / access control | WordPress membership (via MemberPress or similar) has no equivalent in Payload baseline. Requires custom access control fields. |
| FluentCommunity community posts | No standard API. Requires manual extraction. Content structure varies. |
| WP shortcodes | Payload has no shortcode system. Must be converted to Lexical nodes or dropped. |
| Embedded iframes | Not supported in Lexical without a custom embed node. |
| Tables | Not supported in Lexical without a custom table node. |
| Advanced Custom Fields (ACF) | Custom fields must be added to Payload collections before migration. |
| Post meta / custom taxonomies | Must be mapped to Payload fields added to the collection schema. |
| WP comments | No comments collection in Payload baseline. Requires a new collection. |
| Scheduled posts | WP draft/scheduled states → Payload `draft` status. Scheduling requires a custom job queue. |
| WooCommerce / LMS content | Course, lesson, and product structures require custom Payload collections with matching schemas. |
| Internal WP links | Links like `/wp-content/uploads/...` or `/blog/post-slug/` need URL rewriting to match the new frontend URL structure. |
| Featured images embedded in content | Featured image is a separate field in WP (`featured_media`); in Payload it must be added as a `featuredImage` upload field to the Posts collection (not in the current schema — add it before migration). |

### Data volume considerations

- The Payload Local API processes records one at a time. For large volumes (> 1000 posts), add a delay between inserts to avoid overloading the database connection pool.
- Media downloads are slow. Download all media files first to a local directory, then upload in a second pass.
- Run the full import against a development/staging environment first, never directly against production on the first attempt.

### Slug conflicts

WordPress slug uniqueness is per post type. Payload slug uniqueness is per collection but global within it. If a WordPress post and page share a slug, one will fail on insert. Resolve this before importing.

### Character encoding

WordPress content is UTF-8 but may contain Windows-1252 characters (curly quotes `"`, em dashes `—`, etc.) encoded as HTML entities (`&ldquo;`, `&mdash;`). The HTML parser must decode entities before converting to Lexical text nodes.

### Date fields

Payload auto-sets `createdAt` and `updatedAt` to the current timestamp on insert. If preserving original WP publish dates is important, add `publishedAt` custom fields to the collections before migrating.

---

## Migration process — step by step

### Before starting

1. Confirm `restore/payload-baseline` tag is on `main` and pushed to remote
2. Create branch: `git checkout -b feature/payload-migration`
3. Test that `https://jpvbootcamp.com/app` loads correctly and you can log in
4. Take a PostgreSQL backup of the `jpvbootcamp` schema (done automatically by `deploy-prod.sh`, or run manually)
5. Count WordPress content: number of posts, pages, categories, media items

### Step 1 — Audit the source content

Before writing any code, understand what you're migrating:

```bash
# Count WP posts
curl "https://portal.jpvbootcamp.com/wp-json/wp/v2/posts?per_page=1" -I | grep X-WP-Total

# Count WP pages
curl "https://portal.jpvbootcamp.com/wp-json/wp/v2/pages?per_page=1" -I | grep X-WP-Total

# Count WP media
curl "https://portal.jpvbootcamp.com/wp-json/wp/v2/media?per_page=1" -I | grep X-WP-Total

# Sample one post to understand the HTML structure
curl "https://portal.jpvbootcamp.com/wp-json/wp/v2/posts?per_page=1" | python3 -m json.tool
```

### Step 2 — Extend the schema if needed

Before importing any data, decide if the current Payload schema is sufficient. If not, add fields to the collection and create a Payload migration:

- Add `featuredImage` upload field to `PayloadPosts` if you want to migrate WP featured images
- Add `publishedAt` timestamp field if you want to preserve original dates
- Add a `source` text field to record the original WP post ID for traceability
- Add custom fields for any WP custom fields (ACF etc.) you want to preserve

After changing a collection schema, run `pnpm payload migrate:create` to generate a migration file, and commit it with the collection change.

### Step 3 — Write migration scripts

Scripts live in `scripts/migration/`. They use `tsx` to run TypeScript directly.

Suggested structure:
```
scripts/migration/
├── lib/
│   ├── wp-api.ts          # Functions to fetch from WP REST API
│   ├── html-to-lexical.ts # HTML string → Lexical JSON converter
│   └── id-map.ts          # Persist WP ID → Payload ID mappings to a JSON file
├── 01-categories.ts       # Migrate categories (run first)
├── 02-media.ts            # Download WP media, upload to Payload
├── 03-posts.ts            # Migrate posts
├── 04-pages.ts            # Migrate pages
└── verify.ts              # Count records, check for import errors
```

Each script:
1. Fetches content from WP REST API (paginated)
2. Converts it to Payload format
3. Writes to Payload via Local API (`payload.create()`)
4. Saves `wpId → payloadId` to a JSON file for the next step to use
5. Logs success count, skip count, and error count

### Step 4 — Test on a sample

Run each script against the first 10 items only. Review the results in the Payload admin (`https://jpvbootcamp.com/app`). Check:
- Do posts display correctly in the admin?
- Does the rich text render properly?
- Do categories show up?
- Do media images display?

Fix the scripts before running the full import.

### Step 5 — Full import

Run scripts in order:
```bash
tsx scripts/migration/01-categories.ts
tsx scripts/migration/02-media.ts
tsx scripts/migration/03-posts.ts
tsx scripts/migration/04-pages.ts
tsx scripts/migration/verify.ts
```

### Step 6 — Review and clean up in Payload admin

After import, log into `https://jpvbootcamp.com/app` and review:
- Post count matches WP post count (minus any skipped)
- Rich text renders correctly on a sample of posts
- Images load
- Categories are assigned correctly
- Slugs are correct

### Step 7 — Connect the frontend

The imported content is now in Payload but nothing on the frontend reads from it yet. The next step (separate from migration) is to update the frontend to fetch from Payload instead of WordPress for each content type.

---

## Running scripts locally vs. in production

### Local development (preferred for testing)

```bash
# Set up a local Payload environment pointing to production DB
# WARNING: if DATABASE_URL points to production, you ARE writing to production
# Use a staging DB or a separate schema for testing

DATABASE_URL=postgresql://... PAYLOAD_SECRET=... tsx scripts/migration/01-categories.ts
```

### In production (via Dokploy)

The production database is only accessible from within the Dokploy VNet (`10.0.2.4:5433`). Migration scripts cannot connect to it from a local machine.

Options:
1. Run scripts inside a Dokploy one-off container (same VNet as the app)
2. Set up a temporary OrbStack local Postgres with a copy of the data for testing, then run on production via Dokploy

---

## What to add to Payload before migration

The current `restore/payload-baseline` schema is intentionally minimal. Before the full migration, extend the collections:

### Recommended additions to PayloadPosts

```ts
{ name: 'featuredImage', type: 'upload', relationTo: 'payload_media' },
{ name: 'publishedAt', type: 'date' },
{ name: 'wpId', type: 'number', admin: { description: 'Original WordPress post ID — for traceability' } },
{ name: 'excerpt', type: 'textarea' },
```

### Recommended additions to PayloadPages

```ts
{ name: 'publishedAt', type: 'date' },
{ name: 'wpId', type: 'number', admin: { description: 'Original WordPress page ID' } },
```

Every schema change must be followed by a Payload migration (`pnpm payload migrate:create`), committed to the branch, and deployed before the migration scripts run.

---

## References

| Document | What it covers |
|----------|---------------|
| `docs/ARCHITECTURE.md` | Full system map: Stripe, WP, FluentCRM, MU plugins, all data flows — **read first** |
| `docs/PAYLOAD_CMS.md` | Payload installation, collections, tables, restore points |
| `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md` | Full Payload course system, entitlements, billing, CRM, groups, chat, and cutover plan |
| `docs/PROKIT_DATABASE.md` | Database schema, connections, Prisma vs Payload ownership |
| `docs/STRIPE_MEMBERSHIP_FLOW.md` | Stripe events, plan resolution, email deduplication |
| `docs/STRIPE_WP_PROVISIONING.md` | WP provisioning endpoint, MU plugin setup, billing portal handoff, env vars |
| `docs/PROKIT_INFRASTRUCTURE.md` | Dokploy, VNet, deployment pipeline |
| Payload Lexical docs | https://payloadcms.com/docs/rich-text/lexical |
| WordPress REST API docs | https://developer.wordpress.org/rest-api/reference/ |
| Payload Local API docs | https://payloadcms.com/docs/local-api/overview |
