# JPV Bootcamp — Redesign Roadmap

**Branch:** `feature/course-branding-and-preview`  
**Scope:** Staging only (`https://preview.jpvbootcamp.com`)  
**Timeline:** Finish today (2026-08-22), refine tomorrow

---

## Overview

Three phases in order:

1. **Global design tokens** — replace current green system with Beige & Teal everywhere
2. **Homepage** — 13-section rebuild per client DOCX + new logos
3. **Member portal** — sidebar layout, rich composer, enhanced cards, course UI, resources library
4. **PayloadCMS admin** — apply same tokens to admin panel

---

## Phase 0 — Design tokens (prerequisite to everything)

**Files to change:**

- `src/lib/brand/jpvDesignSystem.ts` — update `jpvDesignTokens.colors.*` to Beige & Teal values
- Any global CSS file that injects CSS variables (search for `--jpv-` in styles)
- `tailwind.config.ts` — no structural change needed; it reads `--jpv-*` vars already

**New token values (from `color-system.css` client brief):**

| Current token | Current hex | New hex | Source |
|---|---|---|---|
| `brand` | `#2f805b` | `#2C9E9E` | `--teal-500` — primary accent |
| `brandHover` | `#276e4f` | `#238383` | `--teal-600` |
| `brandDeep` | `#123d2d` | `#1B6767` | `--teal-700` |
| `brandBright` | `#6bcf8a` | `#74C4C4` | `--teal-300` |
| `canvas` | `#fffefa` | `#FAF8F4` | `--beige-50` — page background |
| `surface` | `#f5f3ec` | `#F4F0E8` | `--beige-100` |
| `surfaceStrong` | `#e8ece7` | `#E9E2D5` | `--beige-200` |
| `ink` | `#24332b` | `#3A3428` | `--beige-900` — primary text |
| `muted` | `#687068` | `#A89A80` | `--beige-500` |
| `inverseMuted` | `#c7d3cc` | `#6E6350` | `--beige-700` |
| `border` | `#dedbd1` | `#D9CFBC` | `--beige-300` |
| `focus` | `#123d2d` | `#238383` | `--teal-600` |

**Semantic additions to add to `jpvDesignSystem.ts`:**

```ts
tealScale: {
  50:  '#EAF6F6',
  100: '#CFEAEA',
  200: '#A6D9D9',
  300: '#74C4C4',
  400: '#4EB0B0',
  500: '#2C9E9E',
  600: '#238383',
  700: '#1B6767',
  800: '#144E4E',
  900: '#0D3838',
},
beigeScale: {
  50:  '#FAF8F4',
  100: '#F4F0E8',
  200: '#E9E2D5',
  300: '#D9CFBC',
  400: '#C2B49B',
  500: '#A89A80',
  700: '#6E6350',
  900: '#3A3428',
},
```

**Logo paths to update in `jpvDesignSystem.ts`:**

```ts
export const jpvBrand = {
  name: 'JPV Bootcamp',
  tagline: 'Our passion is people',
  logoAlt: 'JPV — Our passion is people',
  logoPath: '/images/jpv-logo-stacked.png',       // vertical (icon + JPV + tagline)
  logoHorizontalPath: '/images/jpv-logo-horizontal.png', // horizontal (icon left + text right)
}
```

**⚠️ Logos not yet saved to repo.** The two logo images (stacked + horizontal, black background) must be placed at:
- `public/images/jpv-logo-stacked.png`
- `public/images/jpv-logo-horizontal.png`

Client needs to re-share logo image files so they can be copied in.

---

## Phase 1 — Homepage (13 sections in order)

Current homepage: `src/app/(frontend)/page.tsx` + `landing.module.scss`

Nav bar links to update:
```
Home | About | Membership | Community | Events | Success Stories | Pricing | Contact
```
(Support | Sign In | Join remain in top-right)

### Section 1 — Hero

**Copy:**
```
Choose Purpose over Comfort
FOR THOSE CALLED BEYOND THE ORDINARY

Transforming Lives. Equipping Purpose. Inspiring Freedom.
Invest wisely, steward faithfully, and bless generously through Christian property
education shaped by wisdom, strategy and stewardship.

[Become a member]  [See how it works]
Plans start at £80 per month or £800 paid annually.
```

**Images:** Use image from batch (to be assigned — pick hero-appropriate landscape from batch 1 or 2)  
**Colors:** Dark background section (teal-800 or teal-900); heading white; accent teal-300

---

### Section 2 — Let's Do It Together (4 Pillars) [ABOUT]

**Heading:** `Let's do it together.`  
*(Delete old heading: "Learn deeply. Apply wisely. Build with purpose.")*

**4 cards with updated text + updated images (from batch 1/2):**

| Card | Heading | Body |
|---|---|---|
| 1 | KNOWLEDGE & GUIDANCE | Learn the principles. Build the knowledge. Invest with confidence. |
| 2 | PRACTICAL APPLICATION | Put learning into action through real property strategies and opportunities. |
| 3 | LIVE EXPERIENCES | Connect with experts, gain practical insight and apply action. |
| 4 | COMMUNITY & ACCOUNTABILITY | Grow together with people who share your vision, Christian values and ambition. |

**Images:** Assign one image per pillar from batch 1 (Structured Learning, Practical Application, Live Experiences, Community Support)

---

### Section 3 — Who Is JPV Bootcamp For? [ABOUT]

**Change:** Replace the person/group image with new one from batch  
**Copy:** No change specified (keep existing)

---

### Section 4 — How JPV Bootcamp Works [ABOUT]

**Change:** Add a background image to this section  
**Copy:** No change specified (keep existing)

---

### Section 5 — What Your Membership Gives You (14 Benefits) [MEMBERSHIP]

**Full replacement content — 14 benefit items:**

1. Training That Never Stops – Access to property training, courses, workshops and educational content designed to help you grow from your first deal to building a substantial portfolio.
2. A Christian Property Community – Connect with like-minded Christians who share your faith, values and desire to build through property while supporting one another.
3. Your Own Property Network – Meet people who can become future JV partners, investors, mentors, contractors, deal sourcers and business connections.
4. Private Groups & Rooms – Have your own private spaces to communicate with your group, hold video meetings, discuss projects and build relationships away from the wider community.
5. 1-to-1 & Private Messaging – Communicate privately with other members, build relationships and discuss opportunities directly.
6. Property Resources Library – Access documents, templates, guides, checklists and other resources you need throughout your property journey, all in one place.
7. Find Your First Property – Get practical guidance on how to identify, assess and secure the right property rather than simply learning the theory.
8. Help to Finance Your First Deal – Understand funding options and receive support as you work towards financing your first property.
9. Renovation & Development Support – Get guidance through the renovation process, including planning your works, understanding costs and finding suitable contractors.
10. Contractor & Professional Connections – Access a growing network of people who can help you move your projects forward.
11. Support From Purchase to Exit – Your journey doesn't end when you buy. Get guidance through renovation, letting, refinancing, selling and the next stage of your strategy.
12. Build JVs With Other Members – Find people within the community whose skills, experience, capital or opportunities complement your own and explore joint ventures together.
13. Build Your Portfolio – Once you complete your first deal, continue using the platform to find your next opportunity and develop a long-term property strategy.
14. Access Bigger Opportunities – As your experience grows, connect with other members and explore larger projects and more significant property opportunities.
15. Stay Accountable – Don't disappear after completing your training. Stay connected to a community that can encourage you, challenge you and help you keep moving forward.

**Closing copy (below benefits):**
```
Your training is only the beginning.
We don't want to train you and then leave you on your own. Your membership gives you
access to an ongoing Christian property community where you can continue learning,
building relationships, finding opportunities and receiving practical support as you
build your property journey.
```

**Layout:** Grid of benefit cards (icon + title + body). Not just a bullet list — needs to feel like a platform showcase.

---

### Section 6 — Your Ongoing Member Journey / Daily Principle [MEMBERSHIP]

**Status: Pending client decision on content management.**  
The client asked: "Do you want them a week in advance to be pre-loaded? Or will the website do this on its own?"

**For now:** Implement a visually styled placeholder section with a sample daily principle card layout. Wire up as a static section until client confirms the management model. Do NOT build a CMS integration yet.

---

### Section 7 — Community

**Full replacement copy:**

Heading: `More Than Property. A Community With Purpose.`  
Sub-heading: `We Don't Build Alone.`

```
JPV Bootcamp is a living Christian property investment community — people coming together to
learn, pray, take action and build together.

We're not just learning about property. We're learning about ourselves. As we grow in knowledge,
confidence and faith, we challenge the mindsets that have held us back and discover what we are
capable of building.

Together, we're buying properties, developing businesses, creating opportunities and supporting
one another through the challenges and victories along the way. Some are taking their first steps
into property; others are building portfolios, developing their skills and discovering new
possibilities for their future.

But the journey goes beyond property. It's about transformation — becoming the people we are
called to be, discovering our purpose and using what we build to make a difference in the lives
of others.

There is practical support, prayer, accountability, friendship and genuine partnership. We
celebrate each other's progress, walk through challenges together and create opportunities for
one another to grow.

We learn together. We pray together. We build together. We grow together.
```

**Buttons (keep):** "Become a Member" | "How onboarding works"  
**Image:** Try batch 2 images — pick one that works for community feel  
**Note:** Benefits already defined in Section 5 — don't restate them here

---

### Section 8 — Meet Your Teachers [COMMUNITY]

**Layout:** Two instructor cards side by side (desktop) / stacked (mobile)

**Instructor 1 — Athina Amadi**
- Title: Founder & CEO, JCCP Holdings and JC Citadels Capital Ltd; Founder of JPV Bootcamp; Visionary Investor, Kingdom Strategist, Property & Wealth Mentor
- Bio: *With over 20 years' experience in property and 28 years in Christian ministry, she has led major residential, commercial, and social housing projects across the UK and internationally, combining commercial expertise with a passion for creating lasting social impact. Athina has successfully delivered property transactions ranging from residential developments to landmark commercial projects, working alongside architects, contractors, and planning professionals. Today, she leads several diversified businesses focused on property, sustainable ventures, finance, food, water, and energy, while equipping aspiring Christian Property investors with the knowledge and confidence to build wealth through property. Passionate about economic empowerment, Athina has helped many individuals take their first steps into property ownership through JPV Bootcamp. Her mission is to equip people with practical strategies, Kingdom principles, and the mindset to build sustainable wealth, create generational legacy, and become transformational leaders in business and their communities.*

**Instructor 2 — Koprinka Aksaray**
- Title: Chief Operating Officer (COO), JCCP Holdings; International Property Investment Strategist; Private Equity & Sustainable Development Specialist
- Bio: *With over 20 years of experience across the UK, Europe, and Africa, she has built extensive expertise in property investment, large-scale developments, and international acquisitions. Throughout her career, Koprinka has contributed to landmark regeneration projects, including the iconic Battersea Power Station redevelopment, alongside numerous commercial and residential developments. She has also successfully raised £22 million for an international development project and gained valuable private equity experience through business acquisitions and cross-sector investments. Driven by a passion for innovation and sustainability, Koprinka is committed to creating resilient, future-ready communities that generate long-term economic and social impact. She brings strategic insight, operational excellence, and global investment experience to help aspiring property investors and developers build sustainable wealth and lasting legacy.*

**Guest Speakers:** Remove entirely for now (no speakers confirmed yet)

**Images:** Use images from batch 1/2 for instructor headshots — need to confirm which images map to each instructor

---

### Section 9 — Live Experiences [EVENTS]

**No copy changes specified.** Keep existing content.  
Verify event images are still loading correctly.

---

### Section 10 — Real Stories & Testimonies [SUCCESS STORIES]

**Five video testimonies using Bunny library 581531:**

| Name | Location | Video URL |
|---|---|---|
| Raouda | Glasgow, Scotland | `https://player.mediadelivery.net/play/581531/ca8db1b6-b7eb-4930-8403-9919d131629c` |
| Chosen | Portsmouth | `https://player.mediadelivery.net/play/581531/56266f09-d651-4bc5-a5b0-ac9185018018` |
| Tolu | London | `https://player.mediadelivery.net/play/581531/a2d9e18b-eb0b-4d3f-b0e7-31daf7cd6c62` |
| Adanna | Bradford | `https://player.mediadelivery.net/play/581531/4cb8f04f-8b29-4d0d-81b6-5bb4caead36d` |
| Pauline | London | `https://player.mediadelivery.net/play/581531/cda4b492-91af-430d-9bba-4268ccaf8cc2` |

**Individual testimonial quotes** (keep as pull quotes or caption under each video):

- Raouda: *"Hi, my name is Raouda... we've just purchased our first property in Wales... I couldn't be more grateful."*
- Chosen: *"...we secured our first property, and it's been incredible to see our dream of property ownership come to life."*
- Tolu: *"...discovering and developing my leadership skills... invaluable, not only within the group but also for my own property company."*
- Adanna: *"...in such a short space of time, I've already become a property owner. It's an achievement I truly value."*
- Pauline: *"...after just a couple of months, I've become a property owner. I truly thank God for that blessing."*

**Closing section copy (below testimonials):**
```
Across the UK, our members are achieving life-changing results through the JPV Property
training and mentorship programme.
[+ full paragraph text from client DOCX — see raw source document]
```

---

### Section 11 — Your Training Is Only The Beginning [PRICING intro]

Text already included in Section 5 closing. If this is a separate section, display it as a full-width banner CTA row above the pricing plans.

---

### Section 12 — Choose Your Plan [PRICING]

**No content changes required.** Keep existing pricing cards.  
Check if a background image should be added (client noted "try Steve" — confirm before adding).

---

### Section 13 — Final CTA — Q&A and Contact

**No changes specified.** Keep existing Q&A / contact section.

---

## Phase 2 — Member Portal UX Overhaul

Files: `src/components/portal/`, `src/app/(frontend)/portal/`

### Layout changes

**Replace current top nav with sidebar + top bar layout:**

**Left sidebar (fixed, full height):**
- Logo at top (horizontal variant)
- Navigation links: Dashboard, Courses, Live, Updates, Community, Leaderboard, Bookmarks, Members, Partners
- Settings link pinned at bottom
- Collapsible on mobile

**Top bar (horizontal, slim):**
- Left: Page title or breadcrumb
- Right: Notification bell + dark/light mode toggle + avatar (links to /portal/account)

### Community — Post cards

Each post card must have:
- Avatar + display name + time-ago (e.g. "3 months ago")
- Post title + body (truncated)
- Like count + comment count action buttons
- Bookmark icon (toggle)
- Pin indicator if pinned
- Three-dot menu: Copy link, Report, Edit, Unlist, Pin to top, Pin to sidebar, Disable comments, Delete
- Comments clearly nested/indented beneath post (not floating separately)

### Community — Rich post composer

Toolbar above post text area:
- Image upload
- Video attach
- File attachment
- Poll (multi-option, supports end date)
- Emoji picker
- Schedule post (date/time picker)
- "Send announcement email" toggle

### Courses page — Module list

- Each module is collapsible (accordion-style)
- Shows lesson count per module
- Progress sidebar: overall % complete, current lesson continue button
- Instructor card visible on course overview page

### Resources Library

- Restructure from course-shaped layout to knowledge-base / library layout
- Group by category/tag not by course module sequence
- Search bar at top
- Each resource card: title, description, file type badge, download button

### Remove

- Membership upgrade prompts (Pro/VIP tier upsell sections)
- These were Fluent Community remnants — no longer relevant

### Keep

- Partnerships in sidebar navigation (not horizontal nav)

---

## Phase 3 — PayloadCMS Admin Panel

File: `src/app/(payload)/admin/`

- Apply same CSS variable overrides (`--jpv-brand`, `--jpv-canvas`, etc.) to admin theme
- Replace admin logo with `jpv-logo-horizontal.png`
- Check PayloadCMS admin supports custom CSS variables via `admin.meta.css` or equivalent config

---

## Image assignment (to be confirmed)

**Batch 1 images (11 files):**
```
0cd93e1a, 35c9c8f7, 3d9838e0, 45604d2d, 560f2c3b,
7bf44841, 9696c4db, 9bcf9e63, 9f6c7b62, bb5c5308,
eba55a43, image.png
```

**Batch 2 images (9 files):**
```
1aab1e99, 1e171c8b, 3800e3a1, 4a2f46e5, 4d824f9d,
936330d3, bebb4c20, f393d105, f88b0e50
```

All images need to be:
1. Copied to `public/images/redesign/` (or `public/events/` for event photos)
2. Mapped to sections (need client or visual review to confirm which image goes where)

---

## Pending items (block on client)

1. **Logos** — Two logo files must be re-shared (stacked vertical + horizontal, PNG, black background). They were provided in a previous session but not saved to disk.
2. **Instructor headshots** — Which batch images are Athina and Koprinka? Confirm before assigning.
3. **Section 3 image** — Which batch image replaces the "Who is JPV for?" picture?
4. **Section 4 background** — Which batch image for "How JPV Works" background?
5. **Section 7 community image** — Which batch image works for the community section?
6. **Daily Principle management** — Does client want it pre-loaded manually, auto-scheduled, or static for now?
7. **Pricing background** — Does client want an image behind pricing plans? If so, which one?

---

## Execution order

```
[ ] 0. Update jpvDesignSystem.ts — token values to Beige & Teal
[ ] 0. Add new logo files to public/images/
[ ] 0. Find + update all logo references (src/components/logo.tsx, admin config, email templates)
[ ] 1. Homepage — nav bar
[ ] 1. Homepage — Section 1: Hero (copy + image + colors)
[ ] 1. Homepage — Section 2: 4 Pillars (heading + card copy + card images)
[ ] 1. Homepage — Section 3: Who is JPV for? (swap image)
[ ] 1. Homepage — Section 4: How JPV Works (add background)
[ ] 1. Homepage — Section 5: 14 Benefits (full replace)
[ ] 1. Homepage — Section 6: Daily Principle (static placeholder)
[ ] 1. Homepage — Section 7: Community (full copy replace)
[ ] 1. Homepage — Section 8: Meet Your Teachers (new bios + instructor cards)
[ ] 1. Homepage — Section 9: Live Experiences (verify, no copy changes)
[ ] 1. Homepage — Section 10: Testimonials (5 Bunny video embeds + quotes)
[ ] 1. Homepage — Sections 11–13: Pricing / CTA (light pass, no major changes)
[ ] 2. Portal — sidebar + top bar layout
[ ] 2. Portal — post card redesign
[ ] 2. Portal — rich post composer
[ ] 2. Portal — course module collapsible + progress sidebar
[ ] 2. Portal — resources library knowledge-base layout
[ ] 2. Portal — remove upgrade prompts
[ ] 3. Admin — apply design token CSS overrides + logo swap
```
