# ShowUp Landing Page Boilerplate - Instructions

## Overview

This is a simplified Next.js boilerplate designed for rapidly building landing pages with email collection. It provides a clean foundation with modern tech stack, responsive design, and email integration.

**Documentation**: See docs/SETUP.md for detailed setup instructions.

## Technology Stack

### Core Framework

- **Next.js**: 14.2.25 - React framework with App Router
- **React**: 18.3.1 - UI library
- **TypeScript**: 5.x - Type safety

### Email Collection & Management

- **Resend**: 4.0.0 - Email delivery service
  - Documentation: https://resend.com/docs
  - Used for welcome emails and notifications

### Database & ORM

- **Prisma**: 5.16.2 - Database ORM and migrations
  - Documentation: https://www.prisma.io/docs
  - PostgreSQL database with automatic migrations
  - Database schema located in `prisma/schema.prisma`

### Form Handling & Validation

- **Formik**: 2.4.6 - Form management
- **Yup**: 1.4.0 - Schema validation
- **React Hot Toast**: 2.4.1 - Toast notifications

### UI & Styling

- **Tailwind CSS**: 3.4.16 - Utility-first CSS framework
  - Documentation: https://tailwindcss.com/docs
- **Radix UI**: 1.x - Headless UI components
  - Documentation: https://www.radix-ui.com/docs
- **DaisyUI**: 4.10.1 - Tailwind CSS component library
  - Documentation: https://daisyui.com/docs

### Automation Platforms Integration

- **Make (Integromat)**: API integration for workflow automation
  - Documentation: https://www.make.com/en/help
- **n8n**: Workflow automation platform
  - Documentation: https://docs.n8n.io/

### Additional Libraries

- **Axios**: 1.7.9 - HTTP client
- **Formik**: 2.4.6 - Form management
- **Yup**: 1.4.0 - Schema validation
- **React Hot Toast**: 2.4.1 - Toast notifications
- **Lucide React**: 0.408.0 - Icon library

## Environment Variables Configuration

Create a `.env.local` file in the root directory with the following variables:

### Database

```
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

- **Source**: PostgreSQL database connection string
- **Setup**: Create a PostgreSQL database and use the connection string format above

### Authentication (Clerk)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

- **Source**: Clerk Dashboard → API Keys
- **Setup**: Create a Clerk application and copy the publishable and secret keys

### Payment Processing (Stripe)

```
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

- **Source**: Stripe Dashboard → Developers → API Keys
- **Setup**:
  - Create a Stripe account and get API keys
  - For webhook secret: Stripe Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret

### Email Service (Resend)

```
RESEND_API_KEY="re_..."
```

- **Source**: Resend Dashboard → API Keys
- **Setup**: Create a Resend account and generate an API key

### OpenAI Integration

```
OPENAI_API_KEY="sk-..."
```

- **Source**: OpenAI Platform → API Keys
- **Setup**: Create an OpenAI account and generate an API key

### Make (Integromat) Integration

```
MAKE_API_KEY="your_make_api_key"
MAKE_TEAM_ID="your_team_id"
MAKE_API_URL="https://eu2.make.com/api/v2"
```

- **Source**: Make Dashboard → Settings → API
- **Setup**:
  - Generate API key in Make dashboard
  - Find team ID in Make dashboard settings
  - API URL is typically `https://eu2.make.com/api/v2`

### n8n Integration

```
N8N_API_KEY="your_n8n_api_key"
N8N_API_URL="http://localhost:5678/api/v1"
N8N_WEBHOOK_URL="http://localhost:5678/webhook"
```

- **Source**: n8n instance settings
- **Setup**:
  - Install and configure n8n instance
  - Generate API key in n8n settings
  - Configure webhook URL based on your n8n deployment

### WordPress Integration (Optional)

```
WP_REST_ENDPOINT="http://your-wordpress-site.com/wp-json"
```

- **Source**: WordPress site REST API endpoint
- **Setup**: Enable REST API on WordPress site and use the endpoint URL

## Stripe Integration & Webhooks

### Webhook Configuration

The webhook handler is located at `src/app/api/webhook/stripe/route.ts`

**Webhook Events Handled:**

- `checkout.session.completed` - Processes successful payments
- `checkout.session.expired` - Handles abandoned checkouts
- `customer.subscription.updated` - Manages subscription changes
- `customer.subscription.deleted` - Handles subscription cancellations
- `invoice.paid` - Processes successful invoice payments
- `invoice.payment_failed` - Handles failed payments

**Setup Instructions:**

1. Configure webhook endpoint in Stripe Dashboard: `https://yourdomain.com/api/webhook/stripe`
2. Set `STRIPE_WEBHOOK_SECRET` environment variable
3. Webhook automatically updates user subscription status in database
4. Sends confirmation emails via Resend

### Stripe Products Configuration

Configure products in `src/config.ts`:

```typescript
stripe: {
  products: [
    {
      type: 'subscription', // or 'one-time'
      title: 'Product Name',
      productId: 'prod_...',
      priceId: 'price_...',
      price: 25,
      features: [...]
    }
  ]
}
```

## Make (Integromat) Integration

### API Endpoints

- `src/app/api/(make)/scenarios/route.ts` - List available scenarios
- `src/app/api/(make)/scenarios/openAIAssistant/route.ts` - Clone and configure OpenAI assistant scenarios
- `src/app/api/(make)/active/route.ts` - Activate/deactivate scenarios
- `src/app/api/(make)/link/route.ts` - Manage webhook links

### Integration Process

1. **Authentication**: Uses `MAKE_API_KEY` and `MAKE_TEAM_ID`
2. **Scenario Cloning**: Creates copies of existing scenarios with user-specific configurations
3. **OpenAI Integration**: Automatically configures OpenAI connections with user API keys
4. **Webhook Management**: Creates and manages webhooks for user interactions
5. **Database Storage**: Stores project configurations in PostgreSQL

### Make API Usage

- **Base URL**: `https://eu2.make.com/api/v2`
- **Authentication**: Token-based with `Authorization: Token ${MAKE_API_KEY}`
- **Key Endpoints**:
  - `GET /scenarios` - List scenarios
  - `POST /scenarios` - Create new scenario
  - `POST /scenarios/{id}/start` - Activate scenario
  - `POST /scenarios/{id}/stop` - Deactivate scenario
  - `POST /connections` - Create API connections
  - `POST /hooks` - Create webhooks

## n8n Integration

### API Endpoints

- `src/app/api/(n8n)/workflows/openAIAssistant/route.ts` - Clone and configure OpenAI assistant workflows

### Integration Process

1. **Authentication**: Uses `N8N_API_KEY` for API access
2. **Workflow Cloning**: Creates copies of existing workflows with user-specific settings
3. **Credential Management**: Creates OpenAI credentials for each user
4. **Webhook Configuration**: Updates webhook paths for user isolation
5. **Workflow Activation**: Automatically activates cloned workflows

### n8n API Usage

- **Base URL**: Configured via `N8N_API_URL` (typically `http://localhost:5678/api/v1`)
- **Authentication**: API key in header `X-N8N-API-KEY`
- **Key Endpoints**:
  - `GET /workflows/{id}` - Get workflow details
  - `POST /workflows` - Create new workflow
  - `POST /workflows/{id}/activate` - Activate workflow
  - `POST /credentials` - Create credentials

### n8n Setup Requirements

1. **n8n Instance**: Deploy n8n instance (local or cloud)
2. **API Access**: Enable API access in n8n settings
3. **Webhook URL**: Configure `N8N_WEBHOOK_URL` for webhook endpoints
4. **Template Workflows**: Create source workflows with OpenAI assistant nodes

## Database Schema

### Key Models

- **Subscription**: User subscription data and Stripe integration
- **Project**: User projects with automation platform configurations
- **Audiences**: Email audience management for Resend

### Migration Management

```bash
npm run migrate-db  # Run database migrations
npx prisma generate # Generate Prisma client
```

## Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run migrate-db # Run database migrations
```

## Key Configuration Files

- `src/config.ts` - Main application configuration
- `prisma/schema.prisma` - Database schema
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `docker-compose.yml` - Local development services (PostgreSQL, WordPress)

## Architecture Notes

- **App Router**: Uses Next.js 14 App Router for routing
- **Server Actions**: Implements server actions for form handling
- **API Routes**: RESTful API endpoints for external integrations
- **Middleware**: Authentication middleware for protected routes
- **Type Safety**: Full TypeScript implementation with strict typing
- **Component Library**: Modular component architecture with Radix UI primitives
