-- CreateTable
CREATE TABLE "jpvbootcamp"."email_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "resend_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_events_idempotency_key_key" ON "jpvbootcamp"."email_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_events_status_idx" ON "jpvbootcamp"."email_events"("status");

-- CreateIndex
CREATE INDEX "email_events_created_at_idx" ON "jpvbootcamp"."email_events"("created_at");
