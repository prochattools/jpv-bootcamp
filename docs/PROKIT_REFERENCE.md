# ProKit SaaS Builder Reference

## 1. Purpose
This doc defines how to evaluate and generate SaaS ideas for ProKit. When given a concept, the assistant should quickly judge fit, explain whether it’s worth building, and suggest faster/leaner/more profitable alternatives when needed. When asked for new ideas, generate ones that align with the constraints and logic below.

## 2. Mission
Ship small B2B SaaS products fast, cheap, and often. Aim for 80% ideation/validation, 20% execution. Success = real users paying, not perfect apps. The boilerplate does the heavy lifting; if it can’t be shipped in two days, it’s not a fit.

## 3. Fixed tech stack
- Framework: Next.js (App + Pages routers)  
- Language: TypeScript  
- Styling: TailwindCSS + shadcn/ui  
- Auth: Clerk  
- Database: PostgreSQL (Supabase) + Prisma  
- Email: Resend  
- Payments: Stripe (JPV Bootcamp Stripe account)  
- Automation: n8n  
- Included utilities: SEO + Payload-managed content, dashboard, invoice generator, waiting list, component library/animations, built-in analytics and deployment workflow

Ideas must adapt to this stack, not vice versa.

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

## 4. Operating philosophy
1. Speed over perfection: MVP in 1–2 days.  
2. Reuse proven models: pick validated tools from PH/IndieHackers/Twitter, copy what works, improve on complaints.  
3. Strict scope: avoid deep integrations/fancy APIs unless essential; no new architectures.  
4. Automation first: prefer n8n workflows; UI should wrap automation.  
5. Fail fast: most ideas fail; volume wins.  
6. Simple problem, real market: focus on B2B utilities with money/pain; niche down (real estate is the starting point, but any paying niche is fine).  
7. Trustless/passwordless/push-first bias: signed links, real-time push, mobile-first PWAs, links as primary interaction objects.

## 5. Business rules
- Audience: B2B customers who pay for productivity (real estate, finance, legal, trades, etc.).  
- Pricing: default monthly flat fee; pay-per-use only when obvious; freemium only if free tier costs nothing and clearly aids conversion. Revenue beats vanity metrics.  
- Cost discipline: avoid expensive per-use services (SMS/heavy AI) unless pricing supports it; prefer predictable costs via n8n/APIs.  
- Sensitive data: avoid PII/high-trust flows unless upside is large and a simple trustless model fits; assume no inherent user trust.  
- Distribution: automation-friendly (SEO/blog/social); launchable on PH etc.  
- Success definition: 10 paying monthly customers → success; then iterate/raise the bar.

## 6. Evaluation framework
Score each idea 1–10 and justify briefly:
1. Speed fit – buildable with ProKit in ≤2 days?  
2. Complexity – avoids heavy integrations/security/large UIs?  
3. Market proof – existing players or clear demand?  
4. Twist factor – simple differentiator or niche translation?  
5. Automation value – does n8n enable the key logic?  
6. Monetization clarity – obvious monthly charge with Stripe?  
7. Data safety – avoids PII/high-trust?  
8. Build cost – minimal recurring cost?  
9. Simplicity of explanation – one-sentence pitchable?  
10. Probability of paying users – realistic near-term revenue?

Classify as: **Pursue** (strong), **Prototype** (borderline but cheap to test), **Discard** (doesn’t fit speed/cost/trust).

## 7. Idea generation guidelines
When asked for ideas:
- Target niche B2B problems solvable with automation/visualization.  
- Prioritize ideas that:  
  - Fit the ProKit stack.  
  - Deliver value from the dashboard alone.  
  - Avoid external data/sensitive info.  
  - Could earn $10–$100/mo per user.  
  - Favor trustless/passwordless/push-first where possible.
- Each idea should include: one-sentence description, target user/niche, pain solved, core automation/logic, 2–3 MVP features, monetization plan, build time estimate.

## 8. Core attitude
Speed and simplicity are sacred. ProKit is the product factory; n8n is the engine. Ideas are experiments. Ship fast, learn fast, move on.

## 9. Success loop
1. Generate ideas.  
2. Score with Section 6.  
3. Pick ≥7 average.  
4. Build MVP in 48 hours.  
5. Launch publicly.  
6. Watch signups → double down or kill.  
7. Repeat.

## Appendix: Folder tree snapshot (Feb 2025)
Preserves the folder tree from the active Payload/Next.js boilerplate to give future assistants context and avoid duplicating utilities.

```
Dockerfile
README.md
app
  api
    auth
      [...clerk].ts
    webhook
      stripe.ts
  components
    button.tsx
    card.tsx
    modal.tsx
  dashboard
    page.tsx
    settings.tsx
  layout.tsx
  page.tsx
  styles
    globals.css
  utils
    api.ts
    auth.ts
    stripe.ts
  hooks
    useUser.ts
  config
    index.ts
prisma
  schema.prisma
public
  favicon.ico
  robots.txt
  images
    logo.png
scripts
  deploy.sh
  migrate.sh
src
  lib
    db.ts
    mailer.ts
  pages
    _app.tsx
    index.tsx
    api
      hello.ts
      auth.ts
  styles
    tailwind.css
  components
    Header.tsx
    Footer.tsx
  types
    index.d.ts
tailwind.config.js
tsconfig.json
package.json
next.config.js
```
