# Clerk Authentication Guide - MicroSaaS Fast Boilerplate

## Clerk Version and Setup

### Version Information

- **Clerk Next.js SDK**: 5.7.1
- **Documentation**: https://clerk.com/docs
- **Dashboard**: https://dashboard.clerk.com

### Installation

```bash
npm install @clerk/nextjs@5.7.1
```

### Environment Variables

```bash
# Required for client-side operations
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# Required for server-side operations
CLERK_SECRET_KEY="sk_test_..."

# Optional: Custom domain for authentication pages
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

## Project Implementation Overview

### 1. Root Layout Configuration

**File**: `src/app/layout.tsx`

```typescript
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang='en' suppressHydrationWarning>
			<body className={font.className}>
				<Providers>
					<ClerkProvider>
						<Header />
						<main className='min-h-screen pt-24 bg-background'>{children}</main>
					</ClerkProvider>
				</Providers>
			</body>
		</html>
	)
}
```

**Key Points**:

- `ClerkProvider` wraps the entire application
- Provides authentication context to all components
- Must be placed inside other providers but outside main content

### 2. Middleware Configuration

**File**: `src/middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/api/create-checkout-session',
	'/api/webhook/:path*',
	'/dashboard',
	'/api/waiting-list',
	'/waiting-list',
	'/blog',
	'/blog(.*)',
	'/sitemap.xml',
	'/processing-page(.*)',
	'/images/:path*',
])

export default clerkMiddleware((auth, request) => {
	if (!isPublicRoute(request)) {
		auth().protect()
	}
})
```

**Public Routes**:

- Homepage (`/`)
- Authentication pages (`/sign-in`, `/sign-up`)
- API webhooks (`/api/webhook/*`)
- Blog pages (`/blog*`)
- Static assets (`/images/*`)
- Processing page (`/processing-page*`)

**Protected Routes**:

- All other routes require authentication
- Users are automatically redirected to sign-in if not authenticated

### 3. Authentication Pages

#### Sign-In Page

**File**: `src/app/sign-in/[[...sign-in]]/page.tsx`

```typescript
import { SignIn } from '@clerk/nextjs'

export default function Page() {
	return <SignIn forceRedirectUrl='/dashboard' />
}
```

#### Sign-Up Page

**File**: `src/app/sign-up/[[...sign-up]]/page.tsx`

```typescript
import { SignUp } from '@clerk/nextjs'

export default function Page() {
	return <SignUp forceRedirectUrl='/dashboard' />
}
```

**Key Features**:

- Uses Clerk's pre-built components
- Automatic redirect to dashboard after authentication
- Handles all authentication flows (email, social, etc.)

## Client-Side Usage

### 1. User Authentication State

**Hook**: `useUser()`

```typescript
import { useUser } from '@clerk/nextjs'

const { isSignedIn, user, isLoaded } = useUser()

if (!isLoaded) {
	return <div>Loading...</div>
}

if (!isSignedIn) {
	return <div>Please sign in</div>
}

// Access user data
console.log(user.id) // Clerk user ID
console.log(user.firstName) // User's first name
console.log(user.primaryEmailAddress?.emailAddress) // Email
console.log(user.imageUrl) // Profile image
```

### 2. Clerk Instance

**Hook**: `useClerk()`

```typescript
import { useClerk } from '@clerk/nextjs'

const { openSignIn, openSignUp, signOut } = useClerk()

// Open sign-in modal
openSignIn({
	redirectUrl: '/dashboard',
})

// Open sign-up modal
openSignUp({
	redirectUrl: '/dashboard',
})

// Sign out user
signOut()
```

### 3. Custom Sign-In Button Component

**File**: `src/components/ButtonSignin.tsx`

```typescript
const ButtonSignin = ({ text = 'Get started', extraStyle }: Props) => {
	const router = useRouter()
	const { isSignedIn, user } = useUser()
	const { openSignIn } = useClerk()

	const handleClick = () => {
		if (isSignedIn) {
			router.push('/')
		} else {
			openSignIn({
				redirectUrl: '/dashboard',
			})
		}
	}

	if (isSignedIn && user) {
		return (
			<Link href={'/dashboard'} className='btn flex items-center gap-2'>
				{user.hasImage ? (
					<Image
						src={user.imageUrl}
						alt={user.firstName || 'Account'}
						className='w-6 h-6 rounded-full'
						width={24}
						height={24}
					/>
				) : (
					<span className='w-6 h-6 bg-base-300 flex justify-center items-center rounded-full'>
						{user.firstName?.charAt(0) || 'A'}
					</span>
				)}
				{user.firstName || user.primaryEmailAddress?.emailAddress || 'Account'}
			</Link>
		)
	}

	return (
		<Button onClick={handleClick} className='btn'>
			{text}
		</Button>
	)
}
```

**Features**:

- Shows user avatar and name when signed in
- Opens sign-in modal when not authenticated
- Handles profile image fallback
- Responsive design with hover effects

## Server-Side Usage

### 1. Server-Side Authentication

**Function**: `auth()`

```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
	const { userId } = auth()

	if (!userId) {
		redirect('/sign-in')
	}

	// User is authenticated, proceed with protected logic
	return <div>Dashboard content</div>
}
```

### 2. Current User Data

**Function**: `currentUser()`

```typescript
import { currentUser } from '@clerk/nextjs/server'

export default async function Profile() {
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	return (
		<div>
			<h1>Welcome, {user.firstName}!</h1>
			<p>Email: {user.primaryEmailAddress?.emailAddress}</p>
		</div>
	)
}
```

### 3. Clerk Client (Server-Side)

**Function**: `clerkClient`

```typescript
import { clerkClient } from '@clerk/nextjs/server'

// Get user by email (used in Stripe webhooks)
const users = await clerkClient.users.getUserList({
	emailAddress: [customerEmail],
})

// Get specific user
const user = await clerkClient.users.getUser(userId)

// Update user
await clerkClient.users.updateUser(userId, {
	firstName: 'John',
	lastName: 'Doe',
})
```

## Integration with Database

### 1. User ID Storage

The project stores Clerk user IDs in the database:

```prisma
model Subscription {
  user_clerk_id String @unique // Clerk user ID
  // ... other fields
}

model Project {
  user_clerk_id String // Clerk user ID
  // ... other fields
}
```

### 2. User Lookup in Webhooks

**File**: `src/app/api/actions.ts`

```typescript
// Find user by email in Stripe webhook
const users = await clerkClient.users.getUserList({
	emailAddress: [customerEmail],
})

if (!users.data.length) {
	console.error('Clerk user not found')
	return NextResponse.json(
		{
			error: 'No customer email found for subscription',
		},
		{ status: 400 }
	)
}

const user = users.data[0]
```

## Protected Routes Implementation

### 1. Dashboard Protection

**File**: `src/app/dashboard/page.tsx`

```typescript
export default async function Dashboard() {
	const { userId } = auth()

	if (!userId) {
		redirect('/sign-in')
	}

	const sub = await getSubscriptionByUserId(userId)
	const isInactive = sub ? sub?.sub_status !== 'active' : true

	if (isInactive) {
		redirect('/processing-page')
	}

	return (
		<div>
			<Scenarios />
			<ThankYouPopup />
		</div>
	)
}
```

**Protection Layers**:

1. **Authentication**: Redirects to sign-in if not authenticated
2. **Subscription**: Redirects to processing page if subscription is inactive
3. **Content**: Shows protected content only to active subscribers

### 2. API Route Protection

**Example**: `src/app/api/projects/route.ts`

```typescript
export async function GET() {
	try {
		const user = await currentUser()

		if (!user) {
			throw new Error('user is undefined')
		}

		const projects = await prisma.project.findMany({
			where: {
				user_clerk_id: user.id,
			},
		})

		return NextResponse.json({ success: true, projects })
	} catch (err) {
		return NextResponse.json({ error: err.message }, { status: 401 })
	}
}
```

## Authentication Flow

### 1. User Journey

1. **Landing Page**: User visits homepage (public route)
2. **Sign-In**: User clicks "Get Started" → opens sign-in modal
3. **Authentication**: User completes sign-in process
4. **Redirect**: Automatically redirected to `/dashboard`
5. **Subscription Check**: Dashboard checks subscription status
6. **Content Access**: Shows appropriate content based on subscription

### 2. Checkout Integration

**File**: `src/components/CheckoutButton.tsx`

```typescript
const CheckoutButton = ({ priceId, disabled = false }) => {
	const { isLoaded, isSignedIn, user } = useUser()

	const handleCheckout = async () => {
		if (!isLoaded || !isSignedIn) {
			setError('Please sign in to proceed with checkout')
			return
		}

		if (user) {
			await handleCheckoutProcess(
				priceId,
				user.id, // Clerk user ID
				user.primaryEmailAddress?.emailAddress || null,
				setLoading,
				setError
			)
		}
	}

	return (
		<button
			onClick={handleCheckout}
			disabled={loading || !isSignedIn || disabled}
		>
			{isSignedIn ? 'Proceed to Checkout' : 'Sign in to Checkout'}
		</button>
	)
}
```

## Clerk Dashboard Configuration

### 1. Application Setup

1. Create application in Clerk Dashboard
2. Configure authentication methods (email, social providers)
3. Set up custom domains (optional)
4. Configure email templates

### 2. Environment Variables

Copy from Clerk Dashboard → API Keys:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### 3. Webhook Configuration (Optional)

For advanced features, configure webhooks in Clerk Dashboard:

- User created
- User updated
- User deleted

## Security Features

### 1. Automatic Protection

- Middleware protects all non-public routes
- Server-side authentication checks
- Automatic redirects for unauthenticated users

### 2. Session Management

- Secure session handling
- Automatic session refresh
- CSRF protection

### 3. User Data Security

- Encrypted user data storage
- Secure API communication
- GDPR compliance features

## Common Usage Patterns

### 1. Conditional Rendering

```typescript
const { isSignedIn, user } = useUser()

return (
	<div>{isSignedIn ? <UserDashboard user={user} /> : <SignInPrompt />}</div>
)
```

### 2. Loading States

```typescript
const { isLoaded, isSignedIn } = useUser()

if (!isLoaded) {
	return <LoadingSpinner />
}

if (!isSignedIn) {
	return <SignInPage />
}
```

### 3. User Profile Display

```typescript
const { user } = useUser()

return (
	<div className='user-profile'>
		<img src={user.imageUrl} alt={user.firstName} />
		<h2>
			{user.firstName} {user.lastName}
		</h2>
		<p>{user.primaryEmailAddress?.emailAddress}</p>
	</div>
)
```

## Troubleshooting

### Common Issues

1. **User not found in webhooks**

   - Ensure email addresses match between Stripe and Clerk
   - Check webhook timing and user creation order

2. **Authentication redirects**

   - Verify middleware configuration
   - Check public route patterns

3. **User data not loading**

   - Ensure ClerkProvider is properly configured
   - Check environment variables

4. **API route protection**
   - Use `currentUser()` or `auth()` in API routes
   - Handle authentication errors properly
