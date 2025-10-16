-- Drop existing tables
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TABLE IF EXISTS "Audiences" CASCADE;

-- Drop enum if exists
DROP TYPE IF EXISTS "SubscriptionStatus";

-- Create new simplified table
CREATE TABLE "email_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_subscribers_pkey" PRIMARY KEY ("id")
);

-- Create unique index on email
CREATE UNIQUE INDEX "email_subscribers_email_key" ON "email_subscribers"("email");