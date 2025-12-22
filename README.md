# Landing Page Boilerplate — Next.js Template

A clean, fast Next.js landing page boilerplate optimized for email collection and lead generation. Perfect for product launches, newsletters, and lead magnets.

## Tech Stack

### Core Framework
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **DaisyUI** - Tailwind CSS component library

### Database & Backend
- **Prisma** - Type-safe database ORM
- **Supabase PostgreSQL** - Managed PostgreSQL database
- **Resend** - Email service for notifications

### UI Components
- **Radix UI** - Headless UI primitives
- **Lucide React** - Icon library
- **React Hot Toast** - Toast notifications

### Development & Deployment
- **Docker** - Containerization with nginx
- **Dokploy** - Preview deployments and production hosting
- **Git Workflow** - Feature branch workflow with preview deployments

### Form Handling
- **Formik** - Form management
- **Yup** - Schema validation

<sub>**Watch/Star the repo to be notified when updates are pushed**</sub>

## Get Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for database)
- Resend account (for email)

### Quick Setup

1. **Use This Template**
   - Click "Use this template" button on GitHub
   - Or clone: `git clone https://github.com/prochattools/boilerplate-landing-page.git`

2. **Install Dependencies**
   ```bash
   cd your-project-name
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase and Resend credentials
   ```

3. **Database Setup**
   ```bash
   npm run migrate-db
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

### Environment Variables Required
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `RESEND_API_KEY` - Resend API key for email notifications

## Project Notes

- The hero core focus + stats section (FCA basics, Deal analysis, Funding, Lettings, and the stats cards) is currently hidden. Toggle `showHeroHighlights` in `src/app/page.tsx` to re-enable.

## Links

- [📚 Documentation](https://docs.microsaasfast.me/)
- [🧑‍💻 Discord](https://discord.gg/U75p2BQuAH)
- [🧑‍💻 Free clients guide](https://www.notion.so/Product-Hunt-Launch-36a5b9610bf04559b8fcf4a2a7b90ea6?pvs=4)

## Support

Reach out to me on [Twitter](https://twitter.com/DennisBabych) or hello@db2.io

## Development Workflow

**Important**: This boilerplate uses a Git + Dokploy workflow for safe deployments. See [docs/git-workflow.md](./docs/git-workflow.md) for complete details.

**Key Rules:**
- Never push directly to `main`
- Always create feature branches
- Test preview deployments before merging
- Merge to `main` only when ready for production

## Sync ProKit docs/scripts

Pulls the canonical ProKit docs/scripts into this repo via a sparse checkout sync.

- Default repo: `https://github.com/prochattools/prokit.git`
- Default ref: `main`

Run:
```bash
./scripts/sync-prokit-assets.sh
```

Pin to a tag/commit:
```bash
PROKIT_REF=v0.1.0 ./scripts/sync-prokit-assets.sh
```

Use a different repo (rare):
```bash
PROKIT_REPO=https://github.com/prochattools/prokit.git PROKIT_REF=main ./scripts/sync-prokit-assets.sh
```

Outputs:
- Docs → `./docs/`
- Scripts → `./scripts/db` and `./scripts/dev`
- Template README snapshot → `./README.prokit-template.md`

Note: this sync overwrites the listed files and should be committed.

## Setup for New Projects

For each new landing page project:

1. **Use this template** to create a new repository
2. **Update project name** in `package.json` and `src/config.ts`
3. **Configure environment** variables in `.env.local`
4. **Customize content** in components (Hero, Features, FAQ, etc.)
5. **Set up database** with Supabase
6. **Configure email** collection with Resend
7. **Follow the [Git + Dokploy workflow](./docs/git-workflow.md)** for all development

## Features

- ✅ **Responsive landing page** with modern design
- ✅ **Email collection form** with validation
- ✅ **Database integration** with Prisma + Supabase
- ✅ **Email notifications** with Resend
- ✅ **Type-safe development** with TypeScript
- ✅ **Component library** with Radix UI + Tailwind
- ✅ **Docker deployment** ready
- ✅ **Preview deployments** with Dokploy

## Release Notes

**v2.0.0** - Simplified Landing Page Boilerplate
- ❌ Removed Clerk authentication (not needed for landing pages)
- ❌ Removed Stripe payments (simplified to email collection)
- ❌ Removed Make/n8n automation integrations
- ✅ Simplified database schema for email collection
- ✅ Streamlined components for landing page use case
- ✅ Maintained Dokploy + Supabase compatibility
- ✅ Kept modern tech stack (Next.js 14, TypeScript, Tailwind)

**Previous**: Original MicroSaaS boilerplate with full authentication and payment processing.
