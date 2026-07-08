# Front-End Copy Approval Packet — Version 3.4

**Milestone:** Front-end website go-live, 22 July 2026  
**Branch:** `feature/course-branding-and-preview`  
**Client content/input due:** Wednesday, 15 July 2026  
**Internal delivery / handover buffer:** 23 July 2026  
**Client finished-by date:** 24 July 2026  
**Migrations applied:** No  

---

## Purpose

This packet identifies the exact front-end copy and content that requires approval or replacement before the 22 July 2026 front-end website go-live milestone.

**Important:** This packet addresses front-end website delivery only. It does **not** authorize migration execution and does not authorize full platform cutover. This front-end copy approval does not authorize migration execution. Migration remains a separate decision blocked pending migration approval, staging smoke completion, provider/email verification, and final acceptance.

**Migrations applied: No.** No migrations have been applied to this branch and must not be applied to meet the front-end website go-live milestone.

---

## Public Offer Summary

The JPV Bootcamp platform launches with one public paid offering:

- **Product:** JPV Bootcamp Pro membership
- **Pricing:** £80/month with a 12-month commitment, or £880 upfront annually
- **Payment options:** Monthly (commitment-based) or annual (upfront discount)
- **Free tier:** Controlled non-paid access for approved support/pay-it-forward recipients, staff/test access, or administrator-created access. Free is controlled non-paid access only, not a public free tier.
- **Support/pay-it-forward:** Separate offering allowing members to fund controlled Free access for others

---

## Copy Approval Table

The table below lists all public-facing copy that requires client approval or replacement by 15 July 2026.

| Area | Current source/location | Current wording or placeholder summary | Client action needed | Approve as-is? | Replacement copy / notes |
| --- | --- | --- | --- | --- | --- |
| **Hero headline** | `src/components/Hero.tsx` | "Build Your Landing Page in Minutes" (placeholder — this is the boilerplate landing page template, not client-specific copy) | **REPLACE** with JPV Bootcamp hero headline or approve placeholder | — | Client must provide final hero copy. Example: "Train for Property Success with JPV" or equivalent approved text. |
| **Hero tagline** | `src/components/Hero.tsx` lines 113–119 | "A clean, fast Next.js landing page boilerplate optimized for email collection and lead generation." | **REPLACE** with client-approved landing tagline | — | Remove placeholder SaaS template language; replace with JPV Bootcamp specific value proposition. |
| **Hero CTA label** | `src/components/EmailForm.tsx` | "Get Started" (email collection form) | **REVIEW** — is this the right entry point for front-end users? | Yes / No | Client to confirm: Is email collection the primary call-to-action on the landing page, or should this be "Start Pro membership" / "View Membership" / etc.? |
| **Primary membership CTA** | `src/components/portal/MemberCheckoutButtons.tsx` lines 10–18 | "Start Pro monthly" (label); "Monthly payments with a 12-month commitment." (description) | **REVIEW for approval** — matches current spec | Yes / No | Confirm pricing promise copy is final. If changed, update both monthly and annual CTA descriptions. |
| **Primary membership CTA (annual)** | `src/components/portal/MemberCheckoutButtons.tsx` lines 15–17 | "Start Pro annual" (label); "Annual upfront payment." (description) | **REVIEW for approval** — matches current spec | Yes / No | Confirm annual discount and copy is final. Example: "Annual upfront payment — save £80" if discount applies. |
| **Membership tier label** | Page titles, sections | "Pro" | **REVIEW** — single paid tier | Yes / No | Confirm final term for paid tier is "Pro" or if client prefers "Premium," "Plus," "Membership," etc. |
| **Free tier label** | Section headings, feature gates | "Free" (controlled non-paid access only) | **REVIEW** — not a public free tier | Yes / No | Confirm language is clear that Free is controlled access only, not a public signup tier. |
| **Support / pay-it-forward explanation** | `src/components/sponsored-pay-it-forward.tsx` lines 67–74 | "Some members choose to fund controlled Free access for someone who can't pay yet." | **REVIEW for approval** | Yes / No | Finalize pay-it-forward member value proposition. Example: "Sponsor Free access for someone who wants to join but can't afford membership yet." |
| **Support / pay-it-forward CTA** | `src/components/sponsored-pay-it-forward.tsx` line 83 | "Sponsor Free access" (button label) | **REVIEW for approval** | Yes / No | Confirm CTA copy. Alternatives: "Sponsor a member," "Pay it forward," "Fund Free access," etc. |
| **Programme overview headline** | `src/components/Comparison.tsx` line 110 | "Ship SaaS Fast" (placeholder — unrelated to client content) | **REPLACE** with JPV Bootcamp course/programme headline | — | Client must provide course overview headline. Example: "Complete 8-week Property Investment Course" or equivalent. |
| **Programme overview description** | `src/components/Comparison.tsx` lines 111–112 | "No need to write the SaaS wrapper code anymore..." (placeholder SaaS language) | **REPLACE** with JPV Bootcamp course value proposition | — | Remove SaaS template language; replace with course learning outcomes and member benefits. |
| **Course / 8-week structure** | Not yet implemented; template placeholder | Comparison card shows unrelated "Ship SaaS Fast" content | **CREATE** — representative course outline | — | Client must provide: course title, 8-week module structure, module titles, 2–3 key learning outcomes per module. No video content required for front-end launch; can be placeholder or linked from member portal. |
| **FAQ section** | Not yet implemented in active components | Placeholder or empty | **CREATE or POPULATE** FAQ answers | — | Client FAQ topics: (1) What is JPV Bootcamp? (2) Who should join? (3) What is the time commitment? (4) How long is access granted after payment? (5) Is this suitable for beginners? (6) What support is available? (7) Can I cancel? (8) How do refunds work? Client provides final answers or approves placeholders. |
| **Testimonials / proof / trust items** | `src/components/TestimonialsAvatars.tsx` lines 40–80 | Unsplash stock avatars; "25 makers ship faster" placeholder rating | **OPTIONAL** — replace with actual testimonials if available | — | If client has member testimonials, reviews, or social proof, provide: testimonial text, author name, avatar image. Otherwise, stock avatars / placeholder messaging is acceptable for launch. |
| **Partner logos or credibility points** | Not yet implemented | Empty / placeholder | **OPTIONAL** — add if available | — | If JPV Bootcamp has recognized industry partnerships, certifications, or media features, client provides logos and brief credibility statement. Otherwise, this can be removed from launch. |
| **Contact / support footer wording** | `src/components/Footer.tsx` | Generic template footer | **REVIEW/UPDATE** with contact details | — | Client to provide: support email, support website URL, contact form destination, business hours, or support channel routing. |
| **Email collection signup form (hero)** | `src/components/Hero.tsx` lines 124–131 | "Enter your email to get started" (placeholder) | **REVIEW** — is email signup the right entry point? | Yes / No / Modify | Determine: Is this form meant for leads, member onboarding pre-checkout, or newsletter signup? If changed, update placeholder copy and destination. |
| **Email collection signup form (CTA section)** | `src/components/CTA.tsx` lines 24–30 | "Enter your email address" (placeholder); "Join Now" (button) | **REVIEW** — matches purpose | Yes / No / Modify | Confirm email capture purpose and update copy if needed. Example: "Get 10% off your first month" or "Join the JPV Bootcamp community." |
| **Public disclaimers / commitment wording** | Not yet implemented | Empty | **OPTIONAL** — if required by client legal | — | Client to provide any required legal disclaimers, money-back guarantees, or commitment language. Example: "14-day money-back guarantee" or "Full 12-month membership included." |
| **Mobile responsiveness & layout** | All components | Responsive design in place | **VERIFY** in user acceptance | — | Operator confirms responsive design looks correct on mobile (375px), tablet (768px), and desktop (1440px) during acceptance. |
| **Dark mode support** | All components | Dark mode CSS in place | **VERIFY** in user acceptance | — | Operator confirms dark mode rendering is acceptable on all platforms. |

---

## Content Dependency Section

Client must provide the following by **Wednesday, 15 July 2026** for front-end integration:

### Required for launch:

1. **Final hero headline**
   - [ ] Client provides final copy, or
   - [ ] Client approves placeholder (e.g., "Train for Property Success with JPV")

2. **Final hero tagline/value proposition**
   - [ ] Client provides final copy, or
   - [ ] Client approves placeholder

3. **Membership tier terminology & pricing**
   - [ ] Confirm "Pro" is the final paid tier label, or provide alternative
   - [ ] Confirm "Free" terminology for controlled non-paid access
   - [ ] Confirm £80/month and £880/year pricing or provide updated figures
   - [ ] Confirm monthly commitment language or provide alternative

4. **Support / pay-it-forward member value proposition**
   - [ ] Provide final copy for "pay it forward" explanation, or
   - [ ] Approve placeholder language

5. **Course / 8-week programme structure**
   - [ ] Provide course title
   - [ ] Provide 8-week module breakdown (module 1, 2, ... 8 titles)
   - [ ] Provide 2–3 learning outcomes per module (optional, can be brief)
   - [ ] Confirm video provider (YouTube, Vimeo, Mux) or confirm videos not needed for front-end launch

6. **FAQ answers** (at least 5–8 key questions)
   - [ ] What is JPV Bootcamp?
   - [ ] Who should join?
   - [ ] What is the time commitment?
   - [ ] How long is access granted after payment?
   - [ ] Is this suitable for beginners?
   - [ ] What support is available?
   - [ ] Can I cancel?
   - [ ] How do refunds work?
   - [ ] Client provides final answers or approves placeholder FAQ

7. **Contact/support wording**
   - [ ] Support email address or contact form destination
   - [ ] Support website URL (if applicable)
   - [ ] Business hours or support channel

### Optional for launch:

8. **Testimonials / proof / trust items**
   - [ ] Client testimonials, reviews, or social proof (optional)
   - [ ] Testimonial text, author name, avatar/profile image

9. **Partner logos or credibility points**
   - [ ] Industry partnerships, certifications, media features (optional)
   - [ ] Logo files and brief credibility statement

10. **Email signup purpose & copy**
    - [ ] Confirm email collection goal (lead capture, newsletter, member pre-registration)
    - [ ] Provide final copy or approve placeholder

---

## Hard Stops

**Do not proceed past this point if:**

- ❌ Migrations are applied to this branch (they must not be applied before 22 July)
- ❌ `main` branch has been modified (it must remain untouched)
- ❌ Any secrets, API keys, or passwords are committed or visible in public copy
- ❌ Public UI claims migration or cutover readiness (not allowed at this stage)
- ❌ Client content/input has not been received by 15 July 2026

---

## Front-End Acceptance Criteria

Once client content is provided and copy is approved:

### Static validation (local, no network):

- [ ] `git diff --check` passes (no whitespace issues)
- [ ] `./node_modules/.bin/tsc --noEmit --pretty false --incremental false` passes (type-check clean)
- [ ] `./node_modules/.bin/tsx scripts/frontend_copy_approval_static.test.ts` passes (copy approval static test)
- [ ] `pnpm staging:static-preflight` passes (full static preflight bundle)

### Operator manual acceptance:

- [ ] Landing page loads without errors in browser (desktop)
- [ ] Landing page loads without errors in browser (mobile / tablet)
- [ ] Hero headline matches approved copy
- [ ] Membership pricing is displayed correctly (£80/mo or £880/yr)
- [ ] All CTAs route to correct destinations
- [ ] Support / pay-it-forward link is visible and functional
- [ ] FAQ section displays approved answers (or placeholder if approved)
- [ ] Course structure is visible or accessible from member portal
- [ ] No console errors or warnings
- [ ] Payment flow structure is correct (checkout URL format, return URLs)
- [ ] Dark mode renders correctly (if launched in dark mode)
- [ ] Mobile layout is acceptable on all breakpoints

---

## Related Documents

- [Front-End Content Intake Checklist](./FRONTEND_CONTENT_INTAKE_CHECKLIST.md) — operator/client checklist for content dependencies
- [Roadmap Progress Status](./ROADMAP_PROGRESS_STATUS.md) — current branch position and progress
- [JPV Bootcamp Go-Live Plan v3.4 Summary](./JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md) — client-plan update and timeline
- [Operator Handoff Summary](./OPERATOR_HANDOFF_SUMMARY.md) — operator-facing state summary
- [Migration Approval Packet](./MIGRATION_APPROVAL_PACKET.md) — migration decision and execution boundary
- [Status Update Procedure](./STATUS_UPDATE_PROCEDURE.md) — conservative roadmap update process

---

## Summary

**What's ready:** Front-end code, responsive design, checkout flow, member portal structure, static infrastructure  
**What's pending:** Client copy approval and final content by 15 July 2026  
**What's not authorized:** Migration execution or full platform cutover (separate decision)  
**Milestone date:** 22 July 2026 (front-end website go-live)  

Submit final or approved-placeholder copy by **15 July 2026** to meet the front-end milestone target.
