# 🚀 ProKit Trustless Module — Optional Technical Blueprint

**Stack:** Next.js 14 + TypeScript + Prisma + Supabase (Postgres) + Clerk + Stripe + Resend + n8n + Web Push  
**Architecture:** Trustless, passwordless, push-first SaaS engine

---

## 🧠 Overview
This describes the optional **Trustless Module** for ProKit. It is **not** part of the default flow. Enable it only when you need magic links, public tokens, passwordless sharing, or push-first trust-minimized interactions.

> ⚠️ Optional feature  
> Use for apps that require: magic links, public access tokens, passwordless sharing, event-based push notifications, or trust-minimized user actions.

Provides reference implementations for:
- public magic links
- private deeplinks for authenticated actions
- optional QR sharing
- optional push/email notifications
- event-based updates via webhooks or automation

---

## ⚙️ Project Setup

### 1. Clone
```bash
git clone git@github.com:yourusername/yourrepo.git
cd <yourapp>
```

### 2. Install
```bash
npm install
```

### 3. Environment Variables
Create `.env` with:
```bash
# --- Next.js ---
NEXT_PUBLIC_APP_URL=https://<yourapp>.domain
NODE_ENV=production

# --- Clerk Auth ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXX
CLERK_SECRET_KEY=sk_test_XXXXXXXX

# --- Database (Supabase/Postgres) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# --- Stripe ---
STRIPE_SECRET_KEY=sk_live_XXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXX

# --- Resend (emails) ---
RESEND_API_KEY=re_XXXXXXX

# --- JWT ---
LINK_JWT_SECRET=super-secret-jwt-key

# --- Web Push ---
VAPID_PUBLIC_KEY=BNxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxx
VAPID_SUBJECT="mailto:support@<yourapp>.prochat.tools"

# --- n8n Integration ---
N8N_WEBHOOK_URL=https://n8n.prochat.tools/webhook/<yourapp>
N8N_API_KEY=xxxxxx
```

> Keep secrets out of version control; configure per environment.

### 4. Database Migration
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Run locally
```bash
npm run dev
```
Visit http://localhost:3000.

---

## 📁 Folder Structure
```
/app
  /dashboard             -> Optional internal dashboard (Clerk-protected)
  /d/[id]                -> Private deeplink editor
  /l/[token]             -> Public magic link page
  /api                   -> REST endpoints
/public
  /sw.js                 -> Service worker for push
/prisma
  schema.prisma
/lib
  db.ts                  -> Prisma client
  jwt.ts                 -> Sign/verify JWTs
  guards.ts              -> Clerk user checks
  progress.ts            -> Progress/ETA utils
```

---

## 🧱 API Overview

| Route | Description |
|-------|-------------|
| POST /api/resource/create | Create trustless resource + magic/deeplink |
| POST /api/resource/update | Authenticated update endpoint |
| POST /api/events | Log public/private events |
| POST /api/push/subscribe | Store web-push subscriptions |
| POST /api/push/send | Send notifications |
| GET /api/resource/stale | Fetch stale records for automation |

---

## 🔔 Web Push Setup
1. Generate VAPID keys: `npx web-push generate-vapid-keys`  
2. Add keys to `.env`.  
3. Ensure `sw.js` is served from `/public`.  
4. Test in Chrome/Edge (mobile or desktop).

---

## 🤖 n8n Workflows
- **Event Router** (Webhook): route incoming events → push/email/analytics.  
- **Periodic Digest** (Cron): send digests/reminders.  
- **Stale Reminder** (Cron): detect inactivity and notify owners/subscribers.

---

## 📦 Deployment Checklist

| Item | Done |
|------|------|
| ✅ Env vars set in hosting platform |
| ✅ DB migrated and verified |
| ✅ Clerk domain configured |
| ✅ Stripe products configured |
| ✅ Resend domain verified |
| ✅ VAPID keys generated & configured |
| ✅ n8n webhook reachable |
| ✅ PWA/service worker active |

---

## 🔍 Testing Scenarios
1. Create a trustless resource → confirm public + private links.  
2. Visit public link → verify content.  
3. Test push subscription + send push.  
4. Modify resource via private link → confirm propagation.  
5. Test automation integrations (cron/digest/reminder).

---

## 🧾 Versioning & Maintenance

| Component | Update Command |
|------------|----------------|
| Prisma schema | `npx prisma migrate dev` |
| Clerk | managed at [dashboard.clerk.com](https://dashboard.clerk.com) |
| Stripe | via dashboard |
| n8n flows | export/import JSON |
| Dependencies | `npm update` |

---

## Integration rules for Codex
1) Do not enable trustless flows unless explicitly instructed.  
2) Do not rewrite core systems (Clerk, Stripe, Prisma, dashboard, SEO, multi-tenant logic).  
3) Keep changes minimal—add only required routes and reuse existing libs in `/src/libs`.  
4) Trustless pages/routes belong under `/src/app/l/[token]`, `/src/app/d/[id]`, `/src/app/api/...`.  
5) Ask before modifying multi-tenant, push, or PWA systems; clarify token models (JWT structure, lifetimes, subscription shape) before implementing.
