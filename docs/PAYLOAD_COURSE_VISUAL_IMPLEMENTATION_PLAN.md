# Payload Course Visual Implementation Plan

## Status

**Planning only. No Stripe, WordPress, FluentCRM, FluentCommunity, provisioning, billing, email, authentication, or production-data integration is included in this phase.**

This document defines a visual-first prototype of a future course feature inside the existing Payload CMS installation. The prototype exists only to demonstrate the future editorial structure and learner experience to the client before any migration or integration work begins.

---

## 1. Non-negotiable guardrails

### 1.1 Existing production flow remains untouched

The following systems and flows must continue exactly as they work today:

- WordPress at `portal.jpvbootcamp.com`
- FluentCommunity
- FluentCRM
- Stripe Checkout
- Stripe Billing Portal
- Stripe webhooks
- WordPress provisioning
- FluentCRM tag synchronization
- membership emails
- WordPress account emails
- sponsored-seat flows
- partner flows
- WordPress-to-Next.js deletion synchronization
- all existing automations and cron jobs

No existing endpoint, webhook handler, environment variable, plugin, MU plugin, database table, email contract, or automation may be changed as part of the visual Payload course prototype.

### 1.2 Strict system separation

The prototype must be implemented only within the existing Payload and Next.js surface.

Allowed scope:

- new Payload collections
- new Payload fields
- new Payload admin grouping and labels
- new Payload-only seed/demo records
- new visual Next.js prototype routes that read only Payload course data
- new local styles and components for the course prototype
- new documentation and screenshots

Forbidden scope:

- no Stripe wiring
- no WordPress reads or writes
- no FluentCommunity reads or writes
- no FluentCRM reads or writes
- no migration scripts
- no synchronization jobs
- no changes to current authentication or account provisioning
- no changes to existing email behavior
- no changes to Prisma-managed application tables
- no direct production database manipulation
- no third-party LMS plugin
- no external LMS repository copied into the project

### 1.3 Database isolation

Only Payload-managed tables may be created or populated for this prototype.

Rules:

1. Every new collection must use the established `payload_` table naming convention through the existing Payload PostgreSQL adapter.
2. No Prisma-managed table may be altered, populated, renamed, or queried by the prototype.
3. No WordPress MySQL table may be queried or changed.
4. No existing Payload content may be modified unless a later step explicitly identifies the exact record and receives approval.
5. Demo content must be clearly marked as prototype data.
6. The first implementation should use local development data only.
7. Production database migrations are out of scope until the visual prototype has been reviewed and explicitly approved.

### 1.4 Zero-downtime and stop rule

There is no acceptable downtime for the current system.

Stop immediately when any implementation step:

- appears capable of changing current production behavior;
- touches Stripe, WordPress, FluentCRM, FluentCommunity, Prisma tables, or provisioning;
- requires a destructive migration;
- would rename, drop, rewrite, or repurpose an existing field or table;
- creates uncertainty about which database schema is being modified;
- requires production credentials or production data to complete the visual prototype;
- could trigger an existing automation, webhook, email, or CRM action;
- cannot be cleanly reverted through a small isolated code change.

When stopped, document the risk and request an explicit architectural decision before continuing.

---

## 2. Goal of this phase

Produce a visual, navigable demonstration that shows:

- how course content will be organized in Payload CMS;
- how an editor will manage courses, modules, and lessons;
- how the future course menu will look in the Payload admin panel;
- how a future learner dashboard could look;
- how a course overview and lesson page could look;
- how course-access concepts will be represented visually without connecting them to current membership systems.

The prototype does not need to authenticate real members, enforce real access, process payments, or migrate data.

The client should be able to answer these questions after the demo:

1. Is the course hierarchy understandable?
2. Is the editor workflow simple enough?
3. Is the learner experience clear?
4. Are the proposed menu names and labels correct?
5. Is this a suitable target for a future migration?

---

## 3. Prototype product boundary

### Included

- Courses
- Course modules
- Lessons
- Lesson media and downloads
- Course cover images
- Draft and published visual states
- Course visibility labels
- Prototype access labels
- Ordered course navigation
- Prototype lesson-completion display
- Payload admin menu structure
- Learner dashboard mock route
- Course overview mock route
- Lesson mock route
- One representative JPV course with demo content

### Excluded

- Real member login
- Real account creation
- Real Stripe entitlements
- Real course permissions
- Real lesson progress persistence
- Password emails
- Subscription emails
- Failed-payment behavior
- CRM segmentation
- WordPress synchronization
- Community posts
- Chat
- Notifications
- Quizzes
- Certificates
- Historical migration

Excluded features may be represented as disabled labels or static mock states only when that helps the client understand the future design.

---

## 4. Proposed folder structure

The exact existing repository structure must be verified before implementation. The intended visual-first layout is:

```text
src/
├── collections/
│   └── payload-course/
│       ├── Courses.ts
│       ├── CourseModules.ts
│       ├── Lessons.ts
│       ├── CourseAccessPreview.ts
│       └── index.ts
│
├── components/
│   └── payload-course/
│       ├── CourseCard.tsx
│       ├── CourseGrid.tsx
│       ├── CourseHeader.tsx
│       ├── ModuleList.tsx
│       ├── LessonNavigation.tsx
│       ├── LessonContent.tsx
│       ├── LessonProgressPreview.tsx
│       ├── AccessBadge.tsx
│       └── PrototypeBanner.tsx
│
├── app/
│   └── (frontend)/
│       └── course-preview/
│           ├── page.tsx
│           └── [courseSlug]/
│               ├── page.tsx
│               └── [lessonSlug]/
│                   └── page.tsx
│
├── lib/
│   └── payload-course/
│       ├── getCoursePreview.ts
│       ├── getLessonPreview.ts
│       ├── courseTypes.ts
│       └── prototypeGuards.ts
│
└── styles/
    └── payload-course/
        ├── course-preview.module.scss
        └── lesson-preview.module.scss
```

### Folder rules

- Course prototype files stay grouped under `payload-course` or `course-preview` names.
- No prototype code is added to Stripe, WordPress, FluentCRM, FluentCommunity, provisioning, CRM, membership, or billing folders.
- No shared production utility is changed unless the visual prototype cannot be isolated; if that occurs, stop and review.
- Prototype frontend routes must use an unmistakable preview URL and visual banner.

---

## 5. Proposed file responsibilities

| File | Responsibility |
|---|---|
| `Courses.ts` | Course title, slug, summary, cover image, status, visibility label, module relationship and preview settings. |
| `CourseModules.ts` | Ordered sections belonging to one course. |
| `Lessons.ts` | Ordered lesson content, video reference, rich text, downloads and preview metadata. |
| `CourseAccessPreview.ts` | Visual-only access examples such as Free, Pro, VIP, manual or private. No real entitlement logic. |
| `index.ts` | Exports the prototype collections for registration in Payload config. |
| `CourseCard.tsx` | Learner-dashboard card with cover, summary, access badge and mock progress. |
| `CourseGrid.tsx` | Responsive list of prototype courses. |
| `CourseHeader.tsx` | Course cover, title, description and overview metadata. |
| `ModuleList.tsx` | Ordered module and lesson navigation. |
| `LessonNavigation.tsx` | Previous, next and lesson-list navigation. |
| `LessonContent.tsx` | Controlled rendering for rich text, video and downloads. |
| `LessonProgressPreview.tsx` | Non-persistent visual completion state. |
| `AccessBadge.tsx` | Static labels such as Free, Pro, VIP, Preview or Locked. |
| `PrototypeBanner.tsx` | Clear notice that the page is a visual prototype and not the live portal. |
| `getCoursePreview.ts` | Read-only Payload query for prototype courses. |
| `getLessonPreview.ts` | Read-only Payload query for a prototype lesson. |
| `prototypeGuards.ts` | Enforces preview-only routing and prevents accidental use of current membership integrations. |

---

## 6. Payload admin menu structure

The proposed Payload admin navigation should show a single, clearly grouped course area:

```text
Content
├── Pages
├── Posts
├── Categories
├── Media
└── Course Prototype
    ├── Courses
    ├── Modules
    ├── Lessons
    └── Access Preview

Administration
└── Payload Users
```

### Recommended labels

| Collection | Admin label | Singular label |
|---|---|---|
| `payload_courses` | Courses | Course |
| `payload_course_modules` | Modules | Module |
| `payload_lessons` | Lessons | Lesson |
| `payload_course_access_preview` | Access Preview | Access Preview |

All prototype collections should use an admin group label such as:

```text
Course Prototype
```

This keeps them visually separate from existing pages, posts, categories, media, and administrators.

---

## 7. Minimal visual collection design

### 7.1 Courses

Fields shown in the editor:

```text
Course details
- Title
- Slug
- Short description
- Full description
- Cover image
- Status: Draft / Published / Archived
- Visibility preview: Public / Members / Restricted
- Access badge preview: Free / Pro / VIP / Manual
- Estimated duration
- Sort order

Course structure
- Related modules

Prototype settings
- Show in prototype dashboard
- Featured course
- Mock progress percentage
- Prototype note
```

### 7.2 Modules

```text
- Course
- Module title
- Short description
- Sort order
- Published preview toggle
```

### 7.3 Lessons

```text
Lesson details
- Module
- Title
- Slug
- Summary
- Sort order
- Estimated duration

Lesson content
- Rich-text content
- Video provider label
- Video ID or preview URL
- Downloadable resources
- Preview lesson toggle

Prototype settings
- Mock completion state
- Visual lock state
- Prototype note
```

### 7.4 Access Preview

This collection is not a real authorization system. It exists only to demonstrate future possibilities.

```text
- Display label
- Type: Free / Pro / VIP / Manual / Private
- Description
- Badge text
- Example member name
- Related course
- Visual state: Available / Locked / Coming soon
```

It must not read Stripe subscriptions, WordPress users, FluentCRM tags, or FluentCommunity memberships.

---

## 8. Learner-facing visual structure

### 8.1 Prototype dashboard

Route:

```text
/course-preview
```

Visual hierarchy:

```text
JPV Bootcamp
Course Prototype banner

My Courses
├── Featured course card
├── Available course cards
└── Locked / future course examples

Continue learning
└── Last viewed lesson preview
```

Course cards show:

- cover image;
- title;
- short summary;
- lesson count;
- estimated duration;
- static access badge;
- mock progress bar;
- open-course button.

### 8.2 Course overview

Route:

```text
/course-preview/[courseSlug]
```

Visual hierarchy:

```text
Course cover and title
Course summary
Access / status badge
Estimated duration

Course curriculum
├── Module 1
│   ├── Lesson 1
│   ├── Lesson 2
│   └── Lesson 3
├── Module 2
└── Module 3
```

The overview should demonstrate:

- ordered modules;
- ordered lessons;
- lesson duration;
- completed, current, available and locked visual states;
- one public-preview lesson state;
- a clear start/continue button.

### 8.3 Lesson page

Route:

```text
/course-preview/[courseSlug]/[lessonSlug]
```

Visual hierarchy:

```text
Left or collapsible curriculum navigation

Lesson title
Lesson summary
Video or media area
Rich-text lesson content
Downloads
Mock completion control
Previous / next lesson navigation
```

The completion control is visual only in this phase and must not persist member progress.

---

## 9. Representative JPV course

Use one fabricated or explicitly approved representative course. Do not copy production FluentCommunity data without a later migration decision.

Suggested demo course:

```text
JPV Foundations

Module 1 — Start Here
- Welcome to JPV
- Define Your Goal
- How to Use the Program

Module 2 — Build Your Offer
- Understand Your Audience
- Define the Outcome
- Shape the Offer

Module 3 — Put It Into Practice
- Validate the Offer
- Create the Action Plan
- Next Steps
```

Content requirements:

- at least three modules;
- at least three lessons per module;
- one video placeholder;
- one rich-text lesson;
- one downloadable-resource example;
- one preview lesson;
- Free, Pro and VIP badge examples;
- one locked lesson state;
- mock progress at 0%, partial and complete.

All demo records must include a clear prototype marker, such as:

```text
prototype: true
prototypeKey: jpv-foundations-demo
```

---

## 10. Visual-first implementation sequence

### Step 1 — Verify exact current Payload structure

Read only:

- `src/payload.config.ts`
- current collection files;
- current Payload admin grouping;
- current frontend route conventions;
- current style conventions.

Deliverable:

- confirmed implementation paths;
- list of files that can be added without touching current integrations.

Stop if the prototype cannot be isolated.

### Step 2 — Add prototype documentation and boundary constants

Create a small prototype boundary module containing:

```text
PAYLOAD_COURSE_PROTOTYPE_ENABLED
PAYLOAD_COURSE_PROTOTYPE_ROUTE
PAYLOAD_COURSE_PROTOTYPE_BANNER
```

The feature must default off outside the approved development environment until explicitly enabled.

Deliverable:

- preview-only feature boundary;
- visible prototype banner wording.

### Step 3 — Add visual Payload collections

Create:

1. Courses
2. Modules
3. Lessons
4. Access Preview

Register them under the `Course Prototype` admin group.

Deliverable:

- admin menu visible;
- editors can create prototype records;
- no relationship to existing systems.

Validation:

- generated Payload types;
- smallest relevant type check;
- inspect migration output before any database application.

Stop if any generated migration touches a non-`payload_` table.

### Step 4 — Seed one representative course locally

Create local-only prototype seed data.

Deliverable:

- JPV Foundations course;
- three modules;
- representative lessons;
- visual access states;
- media placeholders.

Rules:

- no production database;
- no WordPress or FluentCommunity content extraction;
- no real member records.

### Step 5 — Build the prototype dashboard

Create `/course-preview`.

Deliverable:

- responsive course grid;
- featured course;
- available and locked states;
- static progress examples;
- prototype banner.

### Step 6 — Build the course overview

Create `/course-preview/[courseSlug]`.

Deliverable:

- course header;
- ordered curriculum;
- lesson-state visualization;
- start/continue action.

### Step 7 — Build the lesson view

Create `/course-preview/[courseSlug]/[lessonSlug]`.

Deliverable:

- curriculum navigation;
- lesson media area;
- rich-text content;
- downloads;
- visual completion control;
- previous/next navigation.

### Step 8 — Add client-demo polish

Deliverable:

- desktop and mobile layouts;
- empty, loading, draft, locked and published visual states;
- screenshots of Payload admin and learner pages;
- demo script for the client presentation.

### Step 9 — Review before any functional work

The client and team approve:

- menu terminology;
- course hierarchy;
- lesson layout;
- visibility labels;
- dashboard design;
- mobile behavior;
- editorial workflow.

No real authentication, Stripe, permissions, progress persistence, email, CRM, WordPress, or migration work begins without a new explicitly approved implementation document.

---

## 11. Expected first code slice

The first implementation slice should contain only:

```text
1. Exact repository structure verification
2. Course Prototype admin group
3. Courses collection
4. Modules collection
5. Lessons collection
6. Access Preview collection
7. One local representative course
8. Basic /course-preview dashboard
```

It should not yet include:

- real members;
- course authorization;
- login;
- Stripe;
- emails;
- persistent progress;
- migration tooling.

This is the fastest safe route to a client-visible result.

---

## 12. Validation checklist

Before presenting the prototype:

- [ ] Existing WordPress portal behaves exactly as before.
- [ ] Existing Stripe checkout and billing portal behave exactly as before.
- [ ] Existing Stripe webhooks were not modified.
- [ ] Existing FluentCRM tags and automations were not modified.
- [ ] Existing FluentCommunity content and memberships were not modified.
- [ ] No production email was triggered.
- [ ] No Prisma-managed table changed.
- [ ] Only new Payload collection tables are proposed.
- [ ] Prototype records are clearly marked.
- [ ] Prototype routes show a visible non-production banner.
- [ ] No real member permissions are implied by visual badges.
- [ ] The feature can be disabled without affecting the current site.
- [ ] The client can understand the editor and learner flow from the demo.

---

## 13. Definition of done for the visual phase

The visual phase is complete when:

1. Payload admin visibly contains a separate `Course Prototype` group.
2. An editor can open one representative course, its modules and lessons.
3. A client can visit the preview dashboard, course overview and lesson page.
4. Available, locked, preview and completed visual states are demonstrated.
5. No current integration or production workflow has changed.
6. No real user, payment, CRM, community or migration data is connected.
7. The team has a reviewed list of changes requested before functional implementation.

---

## 14. Future phases are separate projects

The following require new plans and explicit approval:

- member authentication in Payload;
- real per-user course permissions;
- Stripe entitlement synchronization;
- failed-payment restriction and recovery;
- account emails;
- persistent lesson progress;
- WordPress or FluentCommunity migration;
- FluentCRM replacement or synchronization;
- production rollout.

This visual prototype must not be used as implicit authorization for any of those changes.
