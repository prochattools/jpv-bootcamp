# 🚀 ProKit SaaS Starter — Optional Feature README Template

> Stripe note: In this repo, every Stripe reference means the JPV Bootcamp Stripe account.

> ⚠️ Optional template  
> Use this only when documenting an add-on module (trustless, push-first, public-link, etc.). It is **not** an instruction to change core ProKit behavior.

---

## 🧠 Overview

**Feature Type:** \<FEATURE\>  
**Project Name:** \<PROJECT\>  
**Architecture:** (e.g., Trustless, Passwordless, Push-First, Mobile-First)

**One-liner:**  
Describe the SaaS in a single clear line.  
> Example: “Milestone gives clients a live progress link for every project—no logins, no emails.”

**Description:**  
What the app does, who it helps, and the pain it solves. Emphasize speed, simplicity, and automation-friendliness.

---

## ⚙️ Project Setup

### 1. Clone
```bash
git clone git@github.com:yourusername/<repo>.git
cd <repo>
```

### 2. Install
```bash
npm install
```

### 3. Environment Variables
List only the variables that differ from the main ProKit defaults (`README.md` has the baseline):

```bash
NEXT_PUBLIC_APP_URL=https://<project-domain>
LINK_JWT_SECRET=your-jwt-secret
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT="mailto:support@<project-domain>"
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/<project>
```

---

## 🧱 Core Entities (DB schema overview)

| Model | Description |
|--------|--------------|
| `Project` / `Dossier` | Primary record (e.g., mortgage case, client project) |
| `Milestone` | Stages/steps (progress tracking) |
| `Event` | Public interactions (views, requests, updates) |
| `PushSubscription` | Stored push endpoints |
| `User` | Managed via Clerk |

Include Prisma snippets if custom fields are added.

---

## 🔗 Link Architecture

Explain how magic links and deeplinks work.

| Link Type | Route | Access | Description |
|------------|--------|---------|-------------|
| Magic Link | `/l/[token]` | Public | Read-only view |
| Deeplink | `/d/[id]` | Authenticated (Clerk) | Internal editor/dashboard |
| QR Alias (optional) | `/q/[id]` | Redirect | Sharing shortcut |

---

## 🔔 Notification & Automation Flow

### Automations handled by **n8n**
| Workflow | Trigger | Action |
|-----------|----------|--------|
| `Event Router` | HTTP webhook | Routes view/callback events |
| `Weekly Digest` | Cron (Fri 08:30) | Sends Resend digest email |
| `Stale Reminder` | Cron (Daily) | Push reminder for stale records |

**Push-first logic:**  
- On record change → n8n sends web-push via `/api/push/send`.  
- Users enable push via `sw.js` service worker.  
- Fallback: email through Resend.

---

## 🧩 Routes & APIs

| Route | Description |
|--------|--------------|
| `POST /api/<entity>/issue` | Create new record |
| `POST /api/<entity>/update` | Authenticated update |
| `POST /api/events` | Log public actions |
| `POST /api/push/subscribe` | Store subscription |
| `POST /api/push/send` | Send push notification |
| `GET /api/<entity>/stale` | Fetch stale records for n8n |
| `GET /api/owner/:id/summary` | Digest/summary endpoint |

---

## 🧭 UI Overview

Outline pages and key states.

- `/dashboard`: Owner overview (Clerk-protected)  
- `/d/[id]`: Editable view (authenticated)  
- `/l/[token]`: Public magic link  
- `/public/sw.js`: Push service worker  

> Build mobile-first, PWA-friendly UI that feels native.

---

## 📦 Deployment Checklist

| Item | Status | Notes |
|------|---------|-------|
| `.env` configured | ☐ |  |
| Database migrated | ☐ |  |
| Clerk + domain verified | ☐ |  |
| Stripe products live | ☐ |  |
| Resend domain verified | ☐ |  |
| VAPID keys generated | ☐ |  |
| n8n workflows deployed | ☐ |  |
| Push notifications tested | ☐ |  |

---

## 🔍 Testing Scenarios
1. Create new `<PROJECT>` record → links auto-generated.  
2. Open public link (`/l/[token]`) → verify content.  
3. Enable push → confirm subscription saved.  
4. Update record in `/d/[id]` → confirm push delivered.  
5. Wait 7 days → verify digest/reminders.  
6. Stripe checkout → ensure subscription gating works.

---

## 💰 Pricing (example)

| Plan | Features | Price |
|------|-----------|-------|
| Starter | 25 active projects | €19/mo |
| Pro | Unlimited + Branding | €39/mo |
| Team | Multi-user dashboard | €79/mo |

---

## 🧾 Versioning & Maintenance

| Component | Update Command |
|------------|----------------|
| Prisma schema | `npx prisma migrate dev` |
| Clerk | via [dashboard.clerk.com](https://dashboard.clerk.com) |
| Stripe | Dashboard updates |
| n8n flows | JSON export/import |
| Dependencies | `npm update` |

---

## 🧠 Quick Pitch

> **\<PROJECT\>** — powered by the **\<FEATURE\> architecture**.  
> Simple, secure, automation-driven. Launch new SaaS tools in hours, not weeks.

---

## Codex rules for this template
1) Template-only: do not apply to core ProKit unless explicitly told.  
2) Minimal changes: swap `<FEATURE>`/`<PROJECT>`; keep structure intact unless requested.  
3) Do not alter core boilerplate (Clerk, Stripe, Prisma, multi-tenant logic, layout, SEO, dashboard).  
4) Reuse existing ProKit patterns (`/src/app/...`, `/src/app/api/...`, Tailwind/shadcn).  
5) Ask before structural edits if it touches protected systems or adds dependencies.
