# ShowUp Landing Page - Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Resend account

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd showup-landing-page

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### 3. Environment Configuration

Edit `.env.local` with your credentials:

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Email Service (Resend)
RESEND_API_KEY="re_..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Portal upgrade URL (Fluent Community)
NEXT_PUBLIC_PORTAL_UPGRADE_URL="https://YOUR_PORTAL_DOMAIN/path-to-upgrade"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npm run migrate-db
```

### 5. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see your landing page.

## Customization

### Update App Information

Edit `src/config.ts`:

```typescript
const config = {
  appName: 'Your App Name',
  appDescription: 'Your app description',
  domainName: 'yourdomain.com',
  // ... other settings
}
```

### Customize Components

- **Hero Section**: `src/components/Hero.tsx`
- **Features**: `src/components/Features.tsx`
- **FAQ**: `src/components/FAQ.tsx`
- **Footer**: `src/components/Footer.tsx`

### Email Collection

The `EmailForm` component handles email collection:

```tsx
<EmailForm 
  source="hero"
  placeholder="Enter your email"
  buttonText="Get Started"
  showNameField={false}
/>
```

## Deployment

### Using Dokploy

1. Follow the [Git workflow](./git-workflow.md)
2. Push to feature branch
3. Test preview deployment
4. Merge to main for production

### Manual Deployment

1. Build the project: `npm run build`
2. Deploy to your hosting platform
3. Set environment variables
4. Run database migrations

## Features

- ✅ Email collection with validation
- ✅ Responsive design
- ✅ Dark/light theme
- ✅ Type-safe development
- ✅ Database integration
- ✅ Email notifications
- ✅ SEO optimized

## Support

For issues or questions, check the documentation or create an issue in the repository.
