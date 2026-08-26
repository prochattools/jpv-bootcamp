import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import {
  getPayloadMigrationSchema,
  getPayloadMigrationSchemaSqlPrefix,
} from '../lib/payloadMigrationSchema'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const schemaName = getPayloadMigrationSchema()
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = '${schemaName}' AND table_name = 'payload_media'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = '${schemaName}'
        AND table_name = 'payload_media'
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE ${schema}."payload_media" ADD CONSTRAINT "payload_media_pkey" PRIMARY KEY ("id");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = '${schemaName}' AND table_name = 'payload_pages'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = '${schemaName}'
        AND table_name = 'payload_pages'
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE ${schema}."payload_pages" ADD CONSTRAINT "payload_pages_pkey" PRIMARY KEY ("id");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = '${schemaName}' AND table_name = 'payload_posts'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = '${schemaName}'
        AND table_name = 'payload_posts'
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE ${schema}."payload_posts" ADD CONSTRAINT "payload_posts_pkey" PRIMARY KEY ("id");
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = '${schemaName}' AND table_name = 'payload_categories'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = '${schemaName}'
        AND table_name = 'payload_categories'
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE ${schema}."payload_categories" ADD CONSTRAINT "payload_categories_pkey" PRIMARY KEY ("id");
    END IF;
  END
  $$;

   CREATE TYPE ${schema}."enum_payload_courses_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE ${schema}."enum_payload_courses_visibility" AS ENUM('public', 'members', 'restricted');
  CREATE TYPE ${schema}."enum_payload_courses_access_badge" AS ENUM('free', 'pro', 'manual');
  CREATE TYPE ${schema}."enum_payload_lessons_video_provider_label" AS ENUM('none', 'youtube', 'vimeo', 'mux', 'other');
  CREATE TYPE ${schema}."enum_payload_lessons_mock_completion_state" AS ENUM('not_started', 'in_progress', 'completed');
  CREATE TYPE ${schema}."enum_payload_lessons_visual_lock_state" AS ENUM('available', 'locked', 'coming_soon');
  CREATE TYPE ${schema}."enum_payload_course_access_preview_type" AS ENUM('free', 'pro', 'manual', 'private');
  CREATE TYPE ${schema}."enum_payload_course_access_preview_visual_state" AS ENUM('available', 'locked', 'coming_soon');
  CREATE TYPE ${schema}."enum_payload_members_account_status" AS ENUM('pending', 'active', 'blocked', 'suspended', 'deleted');
  CREATE TYPE ${schema}."enum_payload_members_source" AS ENUM('self_signup', 'admin_created', 'stripe_checkout', 'migration');
  CREATE TYPE ${schema}."enum_payload_member_security_events_event_type" AS ENUM('account_created', 'email_verified', 'password_reset_requested', 'password_changed', 'login_failed', 'account_blocked', 'account_restored');
  CREATE TYPE ${schema}."enum_payload_lesson_resources_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE ${schema}."enum_payload_course_enrollments_status" AS ENUM('pending', 'active', 'completed', 'revoked', 'expired');
  CREATE TYPE ${schema}."enum_payload_course_enrollments_source" AS ENUM('manual', 'stripe', 'migration', 'access_policy');
  CREATE TYPE ${schema}."enum_payload_lesson_progress_status" AS ENUM('not_started', 'in_progress', 'completed');
  CREATE TYPE ${schema}."enum_payload_access_groups_status" AS ENUM('active', 'archived');
  CREATE TYPE ${schema}."enum_payload_access_groups_group_type" AS ENUM('manual', 'plan', 'cohort', 'migration');
  CREATE TYPE ${schema}."enum_payload_access_policies_allowed_plans" AS ENUM('free', 'pro');
  CREATE TYPE ${schema}."enum_payload_access_policies_status" AS ENUM('draft', 'active', 'paused', 'archived');
  CREATE TYPE ${schema}."enum_payload_access_policies_resource_type" AS ENUM('course', 'lesson', 'space', 'access_group');
  CREATE TYPE ${schema}."enum_payload_access_policies_privacy" AS ENUM('public', 'members', 'private', 'secret');
  CREATE TYPE ${schema}."enum_payload_access_grants_resource_type" AS ENUM('course', 'lesson', 'space', 'access_group');
  CREATE TYPE ${schema}."enum_payload_access_grants_status" AS ENUM('pending', 'active', 'revoked', 'expired');
  CREATE TYPE ${schema}."enum_payload_access_grants_source" AS ENUM('manual', 'stripe', 'migration', 'policy', 'system');
  CREATE TYPE ${schema}."enum_payload_entitlement_events_event_type" AS ENUM('access_evaluated', 'access_granted', 'access_revoked', 'billing_hold_applied', 'billing_hold_cleared');
  CREATE TYPE ${schema}."enum_payload_entitlement_events_resource_type" AS ENUM('course', 'lesson', 'space', 'access_group');
  CREATE TYPE ${schema}."enum_payload_entitlement_events_result" AS ENUM('allowed', 'denied', 'changed');
  CREATE TYPE ${schema}."enum_payload_billing_accounts_stripe_mode" AS ENUM('test', 'live');
  CREATE TYPE ${schema}."enum_payload_billing_accounts_billing_status" AS ENUM('none', 'active', 'trialing', 'billing_hold', 'past_due', 'unpaid', 'canceled');
  CREATE TYPE ${schema}."enum_payload_subscriptions_plan" AS ENUM('free', 'pro');
  CREATE TYPE ${schema}."enum_payload_subscriptions_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
  CREATE TYPE ${schema}."enum_payload_payments_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'voided');
  CREATE TYPE ${schema}."enum_payload_stripe_events_processing_status" AS ENUM('received', 'processed', 'deduped', 'skipped', 'failed');
  CREATE TYPE ${schema}."enum_payload_billing_actions_action_type" AS ENUM('checkout_completed', 'subscription_created', 'subscription_updated', 'subscription_canceled', 'payment_succeeded', 'payment_failed', 'access_blocked', 'access_restored');
  CREATE TYPE ${schema}."enum_payload_billing_actions_status" AS ENUM('pending', 'completed', 'failed', 'skipped');
  CREATE TYPE ${schema}."enum_payload_contacts_lifecycle_stage" AS ENUM('lead', 'student', 'client', 'partner', 'churned');
  CREATE TYPE ${schema}."enum_payload_contacts_email_status" AS ENUM('subscribed', 'transactional_only', 'unsubscribed', 'bounced', 'complained');
  CREATE TYPE ${schema}."enum_payload_crm_tags_status" AS ENUM('active', 'archived');
  CREATE TYPE ${schema}."enum_payload_contact_tags_source" AS ENUM('manual', 'stripe', 'course', 'migration', 'automation');
  CREATE TYPE ${schema}."enum_payload_contact_notes_note_type" AS ENUM('admin_note', 'support', 'billing', 'course', 'migration');
  CREATE TYPE ${schema}."enum_payload_email_templates_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE ${schema}."enum_payload_email_templates_purpose" AS ENUM('account_created', 'password_changed', 'payment_made', 'subscription_started', 'subscription_canceled', 'payment_failed', 'admin_notification');
  CREATE TYPE ${schema}."enum_payload_email_events_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'skipped');
  CREATE TYPE ${schema}."enum_payload_admin_notifications_notification_type" AS ENUM('account', 'billing', 'course', 'community', 'system');
  CREATE TYPE ${schema}."enum_payload_admin_notifications_severity" AS ENUM('info', 'warning', 'error', 'critical');
  CREATE TYPE ${schema}."enum_payload_admin_notifications_status" AS ENUM('unread', 'read', 'archived');
  CREATE TYPE ${schema}."enum_payload_member_groups_status" AS ENUM('active', 'archived');
  CREATE TYPE ${schema}."enum_payload_member_groups_visibility" AS ENUM('public', 'private', 'secret');
  CREATE TYPE ${schema}."enum_payload_spaces_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE ${schema}."enum_payload_spaces_space_type" AS ENUM('discussion', 'course_cohort', 'announcement', 'chat');
  CREATE TYPE ${schema}."enum_payload_spaces_visibility" AS ENUM('public', 'members', 'private', 'secret');
  CREATE TYPE ${schema}."enum_payload_space_memberships_role" AS ENUM('member', 'moderator', 'admin');
  CREATE TYPE ${schema}."enum_payload_space_memberships_status" AS ENUM('pending', 'active', 'muted', 'blocked', 'removed');
  CREATE TYPE ${schema}."enum_payload_space_posts_post_type" AS ENUM('discussion', 'question', 'announcement');
  CREATE TYPE ${schema}."enum_payload_space_posts_moderation_status" AS ENUM('visible', 'pending_review', 'hidden', 'deleted');
  CREATE TYPE ${schema}."enum_payload_space_comments_moderation_status" AS ENUM('visible', 'pending_review', 'hidden', 'deleted');
  CREATE TYPE ${schema}."enum_payload_space_files_moderation_status" AS ENUM('visible', 'pending_review', 'hidden', 'deleted');
  CREATE TYPE ${schema}."enum_payload_chat_threads_status" AS ENUM('open', 'locked', 'archived');
  CREATE TYPE ${schema}."enum_payload_chat_messages_moderation_status" AS ENUM('visible', 'pending_review', 'hidden', 'deleted');
  CREATE TYPE ${schema}."enum_payload_audit_events_actor_type" AS ENUM('admin', 'member', 'stripe', 'system', 'migration');
  CREATE TYPE ${schema}."enum_payload_audit_events_severity" AS ENUM('info', 'warning', 'critical');
  CREATE TABLE ${schema}."payload_courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prototype" boolean DEFAULT true,
  	"prototype_key" varchar,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short_description" varchar,
  	"description" jsonb,
  	"cover_image_id" integer,
  	"status" ${schema}."enum_payload_courses_status" DEFAULT 'draft' NOT NULL,
  	"visibility" ${schema}."enum_payload_courses_visibility" DEFAULT 'members' NOT NULL,
  	"access_badge" ${schema}."enum_payload_courses_access_badge" DEFAULT 'free' NOT NULL,
  	"estimated_duration" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"show_in_prototype_dashboard" boolean DEFAULT true,
  	"featured" boolean DEFAULT false,
  	"mock_progress" numeric DEFAULT 0,
  	"prototype_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_course_modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prototype" boolean DEFAULT true,
  	"course_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"sort_order" numeric DEFAULT 0 NOT NULL,
  	"published_preview" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prototype" boolean DEFAULT true,
  	"module_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"summary" varchar,
  	"sort_order" numeric DEFAULT 0 NOT NULL,
  	"estimated_duration" varchar,
  	"content" jsonb,
  	"video_provider_label" ${schema}."enum_payload_lessons_video_provider_label" DEFAULT 'none',
  	"video_id_or_preview_url" varchar,
  	"preview_lesson" boolean DEFAULT false,
  	"mock_completion_state" ${schema}."enum_payload_lessons_mock_completion_state" DEFAULT 'not_started',
  	"visual_lock_state" ${schema}."enum_payload_lessons_visual_lock_state" DEFAULT 'available',
  	"prototype_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_lessons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_media_id" integer
  );
  
  CREATE TABLE ${schema}."payload_course_access_preview" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prototype" boolean DEFAULT true,
  	"display_label" varchar NOT NULL,
  	"type" ${schema}."enum_payload_course_access_preview_type" NOT NULL,
  	"description" varchar,
  	"badge_text" varchar,
  	"example_member_name" varchar,
  	"course_id" integer,
  	"visual_state" ${schema}."enum_payload_course_access_preview_visual_state" DEFAULT 'available' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_members_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_status" ${schema}."enum_payload_members_account_status" DEFAULT 'pending' NOT NULL,
  	"source" ${schema}."enum_payload_members_source" DEFAULT 'admin_created' NOT NULL,
  	"email_verified_at" timestamp(3) with time zone,
  	"billing_hold_reason" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"last_login_ip" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE ${schema}."payload_member_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"display_name" varchar NOT NULL,
  	"avatar_id" integer,
  	"timezone" varchar,
  	"phone" varchar,
  	"company" varchar,
  	"marketing_consent" boolean DEFAULT false,
  	"transactional_email_consent" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_member_security_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"event_type" ${schema}."enum_payload_member_security_events_event_type" NOT NULL,
  	"source" varchar,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_lesson_resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"file_id" integer NOT NULL,
  	"status" ${schema}."enum_payload_lesson_resources_status" DEFAULT 'draft' NOT NULL,
  	"download_requires_access" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_course_enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"status" ${schema}."enum_payload_course_enrollments_status" DEFAULT 'active' NOT NULL,
  	"source" ${schema}."enum_payload_course_enrollments_source" DEFAULT 'manual' NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"revoked_reason" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_lesson_progress" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"status" ${schema}."enum_payload_lesson_progress_status" DEFAULT 'not_started' NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"percent_complete" numeric DEFAULT 0,
  	"last_position_seconds" numeric DEFAULT 0,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_access_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" ${schema}."enum_payload_access_groups_status" DEFAULT 'active' NOT NULL,
  	"group_type" ${schema}."enum_payload_access_groups_group_type" DEFAULT 'manual' NOT NULL,
  	"description" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_access_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_members_id" integer
  );
  
  CREATE TABLE ${schema}."payload_access_policies_allowed_plans" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" ${schema}."enum_payload_access_policies_allowed_plans",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_access_policies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" ${schema}."enum_payload_access_policies_status" DEFAULT 'draft' NOT NULL,
  	"resource_type" ${schema}."enum_payload_access_policies_resource_type" NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"privacy" ${schema}."enum_payload_access_policies_privacy" DEFAULT 'private' NOT NULL,
  	"require_active_billing" boolean DEFAULT true,
  	"allow_preview_lessons" boolean DEFAULT false,
  	"priority" numeric DEFAULT 100,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_access_policies_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_access_groups_id" integer
  );
  
  CREATE TABLE ${schema}."payload_access_grants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer,
  	"access_group_id" integer,
  	"resource_type" ${schema}."enum_payload_access_grants_resource_type" NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"status" ${schema}."enum_payload_access_grants_status" DEFAULT 'active' NOT NULL,
  	"source" ${schema}."enum_payload_access_grants_source" DEFAULT 'manual' NOT NULL,
  	"source_id" varchar,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"revoked_reason" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_entitlement_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer,
  	"event_type" ${schema}."enum_payload_entitlement_events_event_type" NOT NULL,
  	"resource_type" ${schema}."enum_payload_entitlement_events_resource_type" NOT NULL,
  	"resource_id" varchar NOT NULL,
  	"result" ${schema}."enum_payload_entitlement_events_result" NOT NULL,
  	"reason" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_billing_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"stripe_customer_id" varchar NOT NULL,
  	"stripe_mode" ${schema}."enum_payload_billing_accounts_stripe_mode" DEFAULT 'test' NOT NULL,
  	"billing_status" ${schema}."enum_payload_billing_accounts_billing_status" DEFAULT 'none' NOT NULL,
  	"default_payment_method_id" varchar,
  	"billing_email" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"billing_account_id" integer NOT NULL,
  	"stripe_subscription_id" varchar NOT NULL,
  	"stripe_price_id" varchar,
  	"stripe_product_id" varchar,
  	"plan" ${schema}."enum_payload_subscriptions_plan" NOT NULL,
  	"status" ${schema}."enum_payload_subscriptions_status" DEFAULT 'incomplete' NOT NULL,
  	"cancel_at_period_end" boolean DEFAULT false,
  	"current_period_start" timestamp(3) with time zone,
  	"current_period_end" timestamp(3) with time zone,
  	"trial_ends_at" timestamp(3) with time zone,
  	"canceled_at" timestamp(3) with time zone,
  	"last_stripe_event_id" varchar,
  	"last_synced_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer,
  	"subscription_id" integer,
  	"stripe_invoice_id" varchar,
  	"stripe_payment_intent_id" varchar,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd' NOT NULL,
  	"status" ${schema}."enum_payload_payments_status" DEFAULT 'pending' NOT NULL,
  	"paid_at" timestamp(3) with time zone,
  	"failed_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_stripe_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_id" varchar NOT NULL,
  	"event_type" varchar NOT NULL,
  	"livemode" boolean DEFAULT false NOT NULL,
  	"processing_status" ${schema}."enum_payload_stripe_events_processing_status" DEFAULT 'received' NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"payload" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_billing_actions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer,
  	"action_type" ${schema}."enum_payload_billing_actions_action_type" NOT NULL,
  	"status" ${schema}."enum_payload_billing_actions_status" DEFAULT 'pending' NOT NULL,
  	"source_event_id" varchar,
  	"notes" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"member_id" integer,
  	"first_name" varchar,
  	"last_name" varchar,
  	"company" varchar,
  	"lifecycle_stage" ${schema}."enum_payload_contacts_lifecycle_stage" DEFAULT 'lead' NOT NULL,
  	"email_status" ${schema}."enum_payload_contacts_email_status" DEFAULT 'subscribed' NOT NULL,
  	"marketing_consent_at" timestamp(3) with time zone,
  	"last_activity_at" timestamp(3) with time zone,
  	"source" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_crm_tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" ${schema}."enum_payload_crm_tags_status" DEFAULT 'active' NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_contact_tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"contact_id" integer NOT NULL,
  	"tag_id" integer NOT NULL,
  	"source" ${schema}."enum_payload_contact_tags_source" DEFAULT 'manual' NOT NULL,
  	"source_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_contact_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"contact_id" integer NOT NULL,
  	"note_type" ${schema}."enum_payload_contact_notes_note_type" DEFAULT 'admin_note' NOT NULL,
  	"body" varchar NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_email_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"template_key" varchar NOT NULL,
  	"status" ${schema}."enum_payload_email_templates_status" DEFAULT 'draft' NOT NULL,
  	"purpose" ${schema}."enum_payload_email_templates_purpose" NOT NULL,
  	"subject" varchar NOT NULL,
  	"preheader" varchar,
  	"text_body" varchar NOT NULL,
  	"html_body" varchar,
  	"admin_copy_required" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_email_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"to_email" varchar NOT NULL,
  	"contact_id" integer,
  	"template_key" varchar NOT NULL,
  	"delivery_status" ${schema}."enum_payload_email_events_delivery_status" DEFAULT 'queued' NOT NULL,
  	"resend_email_id" varchar,
  	"dedupe_key" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"failure_reason" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_admin_notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"notification_type" ${schema}."enum_payload_admin_notifications_notification_type" NOT NULL,
  	"severity" ${schema}."enum_payload_admin_notifications_severity" DEFAULT 'info' NOT NULL,
  	"status" ${schema}."enum_payload_admin_notifications_status" DEFAULT 'unread' NOT NULL,
  	"body" varchar NOT NULL,
  	"related_collection" varchar,
  	"related_document_id" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_member_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" ${schema}."enum_payload_member_groups_status" DEFAULT 'active' NOT NULL,
  	"visibility" ${schema}."enum_payload_member_groups_visibility" DEFAULT 'private' NOT NULL,
  	"description" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_member_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_members_id" integer
  );
  
  CREATE TABLE ${schema}."payload_spaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" ${schema}."enum_payload_spaces_status" DEFAULT 'draft' NOT NULL,
  	"space_type" ${schema}."enum_payload_spaces_space_type" DEFAULT 'discussion' NOT NULL,
  	"visibility" ${schema}."enum_payload_spaces_visibility" DEFAULT 'private' NOT NULL,
  	"linked_course_id" integer,
  	"description" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_spaces_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_access_groups_id" integer
  );
  
  CREATE TABLE ${schema}."payload_space_memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"space_id" integer NOT NULL,
  	"role" ${schema}."enum_payload_space_memberships_role" DEFAULT 'member' NOT NULL,
  	"status" ${schema}."enum_payload_space_memberships_status" DEFAULT 'active' NOT NULL,
  	"joined_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_space_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"space_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"post_type" ${schema}."enum_payload_space_posts_post_type" DEFAULT 'discussion' NOT NULL,
  	"body" jsonb NOT NULL,
  	"moderation_status" ${schema}."enum_payload_space_posts_moderation_status" DEFAULT 'visible' NOT NULL,
  	"pinned" boolean DEFAULT false,
  	"locked" boolean DEFAULT false,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_space_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"post_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"body" jsonb NOT NULL,
  	"moderation_status" ${schema}."enum_payload_space_comments_moderation_status" DEFAULT 'visible' NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_space_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"space_id" integer NOT NULL,
  	"uploaded_by_id" integer NOT NULL,
  	"file_id" integer NOT NULL,
  	"moderation_status" ${schema}."enum_payload_space_files_moderation_status" DEFAULT 'visible' NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_chat_threads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"space_id" integer,
  	"status" ${schema}."enum_payload_chat_threads_status" DEFAULT 'open' NOT NULL,
  	"last_message_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_chat_threads_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_members_id" integer
  );
  
  CREATE TABLE ${schema}."payload_chat_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"thread_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"body" varchar NOT NULL,
  	"moderation_status" ${schema}."enum_payload_chat_messages_moderation_status" DEFAULT 'visible' NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_audit_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"actor_type" ${schema}."enum_payload_audit_events_actor_type" NOT NULL,
  	"actor_id" varchar,
  	"action" varchar NOT NULL,
  	"target_collection" varchar NOT NULL,
  	"target_id" varchar,
  	"severity" ${schema}."enum_payload_audit_events_severity" DEFAULT 'info' NOT NULL,
  	"ip_address" varchar,
  	"user_agent" varchar,
  	"before" jsonb,
  	"after" jsonb,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_courses_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_course_modules_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_lessons_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_course_access_preview_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_members_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_member_profiles_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_member_security_events_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_lesson_resources_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_course_enrollments_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_lesson_progress_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_access_groups_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_access_policies_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_access_grants_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_entitlement_events_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_billing_accounts_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_subscriptions_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_payments_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_stripe_events_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_billing_actions_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_contacts_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_crm_tags_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_contact_tags_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_contact_notes_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_email_templates_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_email_events_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_admin_notifications_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_member_groups_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_spaces_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_space_memberships_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_space_posts_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_space_comments_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_space_files_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_chat_threads_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_chat_messages_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_audit_events_id" integer;
  ALTER TABLE ${schema}."payload_preferences_rels" ADD COLUMN "payload_members_id" integer;
  ALTER TABLE ${schema}."payload_courses" ADD CONSTRAINT "payload_courses_cover_image_id_payload_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_course_modules" ADD CONSTRAINT "payload_course_modules_course_id_payload_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lessons" ADD CONSTRAINT "payload_lessons_module_id_payload_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES ${schema}."payload_course_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lessons_rels" ADD CONSTRAINT "payload_lessons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lessons_rels" ADD CONSTRAINT "payload_lessons_rels_payload_media_fk" FOREIGN KEY ("payload_media_id") REFERENCES ${schema}."payload_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_course_access_preview" ADD CONSTRAINT "payload_course_access_preview_course_id_payload_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_members_sessions" ADD CONSTRAINT "payload_members_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_member_profiles" ADD CONSTRAINT "payload_member_profiles_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_member_profiles" ADD CONSTRAINT "payload_member_profiles_avatar_id_payload_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_member_security_events" ADD CONSTRAINT "payload_member_security_events_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lesson_resources" ADD CONSTRAINT "payload_lesson_resources_lesson_id_payload_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lesson_resources" ADD CONSTRAINT "payload_lesson_resources_file_id_payload_media_id_fk" FOREIGN KEY ("file_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_course_enrollments" ADD CONSTRAINT "payload_course_enrollments_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_course_enrollments" ADD CONSTRAINT "payload_course_enrollments_course_id_payload_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lesson_progress" ADD CONSTRAINT "payload_lesson_progress_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_lesson_progress" ADD CONSTRAINT "payload_lesson_progress_lesson_id_payload_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_groups_rels" ADD CONSTRAINT "payload_access_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_access_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_groups_rels" ADD CONSTRAINT "payload_access_groups_rels_payload_members_fk" FOREIGN KEY ("payload_members_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_policies_allowed_plans" ADD CONSTRAINT "payload_access_policies_allowed_plans_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_access_policies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_policies_rels" ADD CONSTRAINT "payload_access_policies_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_access_policies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_policies_rels" ADD CONSTRAINT "payload_access_policies_rels_payload_access_groups_fk" FOREIGN KEY ("payload_access_groups_id") REFERENCES ${schema}."payload_access_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_grants" ADD CONSTRAINT "payload_access_grants_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_access_grants" ADD CONSTRAINT "payload_access_grants_access_group_id_payload_access_groups_id_fk" FOREIGN KEY ("access_group_id") REFERENCES ${schema}."payload_access_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_entitlement_events" ADD CONSTRAINT "payload_entitlement_events_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_billing_accounts" ADD CONSTRAINT "payload_billing_accounts_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_subscriptions" ADD CONSTRAINT "payload_subscriptions_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_subscriptions" ADD CONSTRAINT "payload_subscriptions_billing_account_id_payload_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES ${schema}."payload_billing_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_payments" ADD CONSTRAINT "payload_payments_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_payments" ADD CONSTRAINT "payload_payments_subscription_id_payload_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES ${schema}."payload_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_billing_actions" ADD CONSTRAINT "payload_billing_actions_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_contacts" ADD CONSTRAINT "payload_contacts_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_contact_tags" ADD CONSTRAINT "payload_contact_tags_contact_id_payload_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES ${schema}."payload_contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_contact_tags" ADD CONSTRAINT "payload_contact_tags_tag_id_payload_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES ${schema}."payload_crm_tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_contact_notes" ADD CONSTRAINT "payload_contact_notes_contact_id_payload_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES ${schema}."payload_contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_email_events" ADD CONSTRAINT "payload_email_events_contact_id_payload_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES ${schema}."payload_contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_member_groups_rels" ADD CONSTRAINT "payload_member_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_member_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_member_groups_rels" ADD CONSTRAINT "payload_member_groups_rels_payload_members_fk" FOREIGN KEY ("payload_members_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_spaces" ADD CONSTRAINT "payload_spaces_linked_course_id_payload_courses_id_fk" FOREIGN KEY ("linked_course_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_spaces_rels" ADD CONSTRAINT "payload_spaces_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_spaces_rels" ADD CONSTRAINT "payload_spaces_rels_payload_access_groups_fk" FOREIGN KEY ("payload_access_groups_id") REFERENCES ${schema}."payload_access_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_memberships" ADD CONSTRAINT "payload_space_memberships_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_memberships" ADD CONSTRAINT "payload_space_memberships_space_id_payload_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_posts" ADD CONSTRAINT "payload_space_posts_space_id_payload_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_posts" ADD CONSTRAINT "payload_space_posts_author_id_payload_members_id_fk" FOREIGN KEY ("author_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_comments" ADD CONSTRAINT "payload_space_comments_post_id_payload_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES ${schema}."payload_space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_comments" ADD CONSTRAINT "payload_space_comments_author_id_payload_members_id_fk" FOREIGN KEY ("author_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_space_id_payload_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_uploaded_by_id_payload_members_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_file_id_payload_media_id_fk" FOREIGN KEY ("file_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_chat_threads" ADD CONSTRAINT "payload_chat_threads_space_id_payload_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_chat_threads_rels" ADD CONSTRAINT "payload_chat_threads_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_chat_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_chat_threads_rels" ADD CONSTRAINT "payload_chat_threads_rels_payload_members_fk" FOREIGN KEY ("payload_members_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_chat_messages" ADD CONSTRAINT "payload_chat_messages_thread_id_payload_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES ${schema}."payload_chat_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_chat_messages" ADD CONSTRAINT "payload_chat_messages_author_id_payload_members_id_fk" FOREIGN KEY ("author_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "payload_courses_prototype_key_idx" ON ${schema}."payload_courses" USING btree ("prototype_key");
  CREATE UNIQUE INDEX "payload_courses_slug_idx" ON ${schema}."payload_courses" USING btree ("slug");
  CREATE INDEX "payload_courses_cover_image_idx" ON ${schema}."payload_courses" USING btree ("cover_image_id");
  CREATE INDEX "payload_courses_updated_at_idx" ON ${schema}."payload_courses" USING btree ("updated_at");
  CREATE INDEX "payload_courses_created_at_idx" ON ${schema}."payload_courses" USING btree ("created_at");
  CREATE INDEX "payload_course_modules_course_idx" ON ${schema}."payload_course_modules" USING btree ("course_id");
  CREATE INDEX "payload_course_modules_updated_at_idx" ON ${schema}."payload_course_modules" USING btree ("updated_at");
  CREATE INDEX "payload_course_modules_created_at_idx" ON ${schema}."payload_course_modules" USING btree ("created_at");
  CREATE INDEX "payload_lessons_module_idx" ON ${schema}."payload_lessons" USING btree ("module_id");
  CREATE UNIQUE INDEX "payload_lessons_slug_idx" ON ${schema}."payload_lessons" USING btree ("slug");
  CREATE INDEX "payload_lessons_updated_at_idx" ON ${schema}."payload_lessons" USING btree ("updated_at");
  CREATE INDEX "payload_lessons_created_at_idx" ON ${schema}."payload_lessons" USING btree ("created_at");
  CREATE INDEX "payload_lessons_rels_order_idx" ON ${schema}."payload_lessons_rels" USING btree ("order");
  CREATE INDEX "payload_lessons_rels_parent_idx" ON ${schema}."payload_lessons_rels" USING btree ("parent_id");
  CREATE INDEX "payload_lessons_rels_path_idx" ON ${schema}."payload_lessons_rels" USING btree ("path");
  CREATE INDEX "payload_lessons_rels_payload_media_id_idx" ON ${schema}."payload_lessons_rels" USING btree ("payload_media_id");
  CREATE INDEX "payload_course_access_preview_course_idx" ON ${schema}."payload_course_access_preview" USING btree ("course_id");
  CREATE INDEX "payload_course_access_preview_updated_at_idx" ON ${schema}."payload_course_access_preview" USING btree ("updated_at");
  CREATE INDEX "payload_course_access_preview_created_at_idx" ON ${schema}."payload_course_access_preview" USING btree ("created_at");
  CREATE INDEX "payload_members_sessions_order_idx" ON ${schema}."payload_members_sessions" USING btree ("_order");
  CREATE INDEX "payload_members_sessions_parent_id_idx" ON ${schema}."payload_members_sessions" USING btree ("_parent_id");
  CREATE INDEX "payload_members_updated_at_idx" ON ${schema}."payload_members" USING btree ("updated_at");
  CREATE INDEX "payload_members_created_at_idx" ON ${schema}."payload_members" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_members_email_idx" ON ${schema}."payload_members" USING btree ("email");
  CREATE UNIQUE INDEX "payload_member_profiles_member_idx" ON ${schema}."payload_member_profiles" USING btree ("member_id");
  CREATE INDEX "payload_member_profiles_avatar_idx" ON ${schema}."payload_member_profiles" USING btree ("avatar_id");
  CREATE INDEX "payload_member_profiles_updated_at_idx" ON ${schema}."payload_member_profiles" USING btree ("updated_at");
  CREATE INDEX "payload_member_profiles_created_at_idx" ON ${schema}."payload_member_profiles" USING btree ("created_at");
  CREATE INDEX "payload_member_security_events_member_idx" ON ${schema}."payload_member_security_events" USING btree ("member_id");
  CREATE INDEX "payload_member_security_events_updated_at_idx" ON ${schema}."payload_member_security_events" USING btree ("updated_at");
  CREATE INDEX "payload_member_security_events_created_at_idx" ON ${schema}."payload_member_security_events" USING btree ("created_at");
  CREATE INDEX "payload_lesson_resources_lesson_idx" ON ${schema}."payload_lesson_resources" USING btree ("lesson_id");
  CREATE INDEX "payload_lesson_resources_file_idx" ON ${schema}."payload_lesson_resources" USING btree ("file_id");
  CREATE INDEX "payload_lesson_resources_updated_at_idx" ON ${schema}."payload_lesson_resources" USING btree ("updated_at");
  CREATE INDEX "payload_lesson_resources_created_at_idx" ON ${schema}."payload_lesson_resources" USING btree ("created_at");
  CREATE INDEX "payload_course_enrollments_member_idx" ON ${schema}."payload_course_enrollments" USING btree ("member_id");
  CREATE INDEX "payload_course_enrollments_course_idx" ON ${schema}."payload_course_enrollments" USING btree ("course_id");
  CREATE INDEX "payload_course_enrollments_updated_at_idx" ON ${schema}."payload_course_enrollments" USING btree ("updated_at");
  CREATE INDEX "payload_course_enrollments_created_at_idx" ON ${schema}."payload_course_enrollments" USING btree ("created_at");
  CREATE INDEX "payload_lesson_progress_member_idx" ON ${schema}."payload_lesson_progress" USING btree ("member_id");
  CREATE INDEX "payload_lesson_progress_lesson_idx" ON ${schema}."payload_lesson_progress" USING btree ("lesson_id");
  CREATE INDEX "payload_lesson_progress_updated_at_idx" ON ${schema}."payload_lesson_progress" USING btree ("updated_at");
  CREATE INDEX "payload_lesson_progress_created_at_idx" ON ${schema}."payload_lesson_progress" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_access_groups_slug_idx" ON ${schema}."payload_access_groups" USING btree ("slug");
  CREATE INDEX "payload_access_groups_updated_at_idx" ON ${schema}."payload_access_groups" USING btree ("updated_at");
  CREATE INDEX "payload_access_groups_created_at_idx" ON ${schema}."payload_access_groups" USING btree ("created_at");
  CREATE INDEX "payload_access_groups_rels_order_idx" ON ${schema}."payload_access_groups_rels" USING btree ("order");
  CREATE INDEX "payload_access_groups_rels_parent_idx" ON ${schema}."payload_access_groups_rels" USING btree ("parent_id");
  CREATE INDEX "payload_access_groups_rels_path_idx" ON ${schema}."payload_access_groups_rels" USING btree ("path");
  CREATE INDEX "payload_access_groups_rels_payload_members_id_idx" ON ${schema}."payload_access_groups_rels" USING btree ("payload_members_id");
  CREATE INDEX "payload_access_policies_allowed_plans_order_idx" ON ${schema}."payload_access_policies_allowed_plans" USING btree ("order");
  CREATE INDEX "payload_access_policies_allowed_plans_parent_idx" ON ${schema}."payload_access_policies_allowed_plans" USING btree ("parent_id");
  CREATE INDEX "payload_access_policies_resource_id_idx" ON ${schema}."payload_access_policies" USING btree ("resource_id");
  CREATE INDEX "payload_access_policies_updated_at_idx" ON ${schema}."payload_access_policies" USING btree ("updated_at");
  CREATE INDEX "payload_access_policies_created_at_idx" ON ${schema}."payload_access_policies" USING btree ("created_at");
  CREATE INDEX "payload_access_policies_rels_order_idx" ON ${schema}."payload_access_policies_rels" USING btree ("order");
  CREATE INDEX "payload_access_policies_rels_parent_idx" ON ${schema}."payload_access_policies_rels" USING btree ("parent_id");
  CREATE INDEX "payload_access_policies_rels_path_idx" ON ${schema}."payload_access_policies_rels" USING btree ("path");
  CREATE INDEX "payload_access_policies_rels_payload_access_groups_id_idx" ON ${schema}."payload_access_policies_rels" USING btree ("payload_access_groups_id");
  CREATE INDEX "payload_access_grants_member_idx" ON ${schema}."payload_access_grants" USING btree ("member_id");
  CREATE INDEX "payload_access_grants_access_group_idx" ON ${schema}."payload_access_grants" USING btree ("access_group_id");
  CREATE INDEX "payload_access_grants_resource_id_idx" ON ${schema}."payload_access_grants" USING btree ("resource_id");
  CREATE INDEX "payload_access_grants_updated_at_idx" ON ${schema}."payload_access_grants" USING btree ("updated_at");
  CREATE INDEX "payload_access_grants_created_at_idx" ON ${schema}."payload_access_grants" USING btree ("created_at");
  CREATE INDEX "payload_entitlement_events_member_idx" ON ${schema}."payload_entitlement_events" USING btree ("member_id");
  CREATE INDEX "payload_entitlement_events_resource_id_idx" ON ${schema}."payload_entitlement_events" USING btree ("resource_id");
  CREATE INDEX "payload_entitlement_events_updated_at_idx" ON ${schema}."payload_entitlement_events" USING btree ("updated_at");
  CREATE INDEX "payload_entitlement_events_created_at_idx" ON ${schema}."payload_entitlement_events" USING btree ("created_at");
  CREATE INDEX "payload_billing_accounts_member_idx" ON ${schema}."payload_billing_accounts" USING btree ("member_id");
  CREATE UNIQUE INDEX "payload_billing_accounts_stripe_customer_id_idx" ON ${schema}."payload_billing_accounts" USING btree ("stripe_customer_id");
  CREATE INDEX "payload_billing_accounts_updated_at_idx" ON ${schema}."payload_billing_accounts" USING btree ("updated_at");
  CREATE INDEX "payload_billing_accounts_created_at_idx" ON ${schema}."payload_billing_accounts" USING btree ("created_at");
  CREATE INDEX "payload_subscriptions_member_idx" ON ${schema}."payload_subscriptions" USING btree ("member_id");
  CREATE INDEX "payload_subscriptions_billing_account_idx" ON ${schema}."payload_subscriptions" USING btree ("billing_account_id");
  CREATE UNIQUE INDEX "payload_subscriptions_stripe_subscription_id_idx" ON ${schema}."payload_subscriptions" USING btree ("stripe_subscription_id");
  CREATE INDEX "payload_subscriptions_stripe_price_id_idx" ON ${schema}."payload_subscriptions" USING btree ("stripe_price_id");
  CREATE INDEX "payload_subscriptions_stripe_product_id_idx" ON ${schema}."payload_subscriptions" USING btree ("stripe_product_id");
  CREATE INDEX "payload_subscriptions_last_stripe_event_id_idx" ON ${schema}."payload_subscriptions" USING btree ("last_stripe_event_id");
  CREATE INDEX "payload_subscriptions_updated_at_idx" ON ${schema}."payload_subscriptions" USING btree ("updated_at");
  CREATE INDEX "payload_subscriptions_created_at_idx" ON ${schema}."payload_subscriptions" USING btree ("created_at");
  CREATE INDEX "payload_payments_member_idx" ON ${schema}."payload_payments" USING btree ("member_id");
  CREATE INDEX "payload_payments_subscription_idx" ON ${schema}."payload_payments" USING btree ("subscription_id");
  CREATE UNIQUE INDEX "payload_payments_stripe_invoice_id_idx" ON ${schema}."payload_payments" USING btree ("stripe_invoice_id");
  CREATE INDEX "payload_payments_stripe_payment_intent_id_idx" ON ${schema}."payload_payments" USING btree ("stripe_payment_intent_id");
  CREATE INDEX "payload_payments_updated_at_idx" ON ${schema}."payload_payments" USING btree ("updated_at");
  CREATE INDEX "payload_payments_created_at_idx" ON ${schema}."payload_payments" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_stripe_events_event_id_idx" ON ${schema}."payload_stripe_events" USING btree ("event_id");
  CREATE INDEX "payload_stripe_events_event_type_idx" ON ${schema}."payload_stripe_events" USING btree ("event_type");
  CREATE INDEX "payload_stripe_events_updated_at_idx" ON ${schema}."payload_stripe_events" USING btree ("updated_at");
  CREATE INDEX "payload_stripe_events_created_at_idx" ON ${schema}."payload_stripe_events" USING btree ("created_at");
  CREATE INDEX "payload_billing_actions_member_idx" ON ${schema}."payload_billing_actions" USING btree ("member_id");
  CREATE INDEX "payload_billing_actions_source_event_id_idx" ON ${schema}."payload_billing_actions" USING btree ("source_event_id");
  CREATE INDEX "payload_billing_actions_updated_at_idx" ON ${schema}."payload_billing_actions" USING btree ("updated_at");
  CREATE INDEX "payload_billing_actions_created_at_idx" ON ${schema}."payload_billing_actions" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_contacts_email_idx" ON ${schema}."payload_contacts" USING btree ("email");
  CREATE INDEX "payload_contacts_member_idx" ON ${schema}."payload_contacts" USING btree ("member_id");
  CREATE INDEX "payload_contacts_updated_at_idx" ON ${schema}."payload_contacts" USING btree ("updated_at");
  CREATE INDEX "payload_contacts_created_at_idx" ON ${schema}."payload_contacts" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_crm_tags_slug_idx" ON ${schema}."payload_crm_tags" USING btree ("slug");
  CREATE INDEX "payload_crm_tags_updated_at_idx" ON ${schema}."payload_crm_tags" USING btree ("updated_at");
  CREATE INDEX "payload_crm_tags_created_at_idx" ON ${schema}."payload_crm_tags" USING btree ("created_at");
  CREATE INDEX "payload_contact_tags_contact_idx" ON ${schema}."payload_contact_tags" USING btree ("contact_id");
  CREATE INDEX "payload_contact_tags_tag_idx" ON ${schema}."payload_contact_tags" USING btree ("tag_id");
  CREATE INDEX "payload_contact_tags_updated_at_idx" ON ${schema}."payload_contact_tags" USING btree ("updated_at");
  CREATE INDEX "payload_contact_tags_created_at_idx" ON ${schema}."payload_contact_tags" USING btree ("created_at");
  CREATE INDEX "payload_contact_notes_contact_idx" ON ${schema}."payload_contact_notes" USING btree ("contact_id");
  CREATE INDEX "payload_contact_notes_updated_at_idx" ON ${schema}."payload_contact_notes" USING btree ("updated_at");
  CREATE INDEX "payload_contact_notes_created_at_idx" ON ${schema}."payload_contact_notes" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_email_templates_template_key_idx" ON ${schema}."payload_email_templates" USING btree ("template_key");
  CREATE INDEX "payload_email_templates_updated_at_idx" ON ${schema}."payload_email_templates" USING btree ("updated_at");
  CREATE INDEX "payload_email_templates_created_at_idx" ON ${schema}."payload_email_templates" USING btree ("created_at");
  CREATE INDEX "payload_email_events_to_email_idx" ON ${schema}."payload_email_events" USING btree ("to_email");
  CREATE INDEX "payload_email_events_contact_idx" ON ${schema}."payload_email_events" USING btree ("contact_id");
  CREATE INDEX "payload_email_events_template_key_idx" ON ${schema}."payload_email_events" USING btree ("template_key");
  CREATE INDEX "payload_email_events_resend_email_id_idx" ON ${schema}."payload_email_events" USING btree ("resend_email_id");
  CREATE INDEX "payload_email_events_dedupe_key_idx" ON ${schema}."payload_email_events" USING btree ("dedupe_key");
  CREATE INDEX "payload_email_events_updated_at_idx" ON ${schema}."payload_email_events" USING btree ("updated_at");
  CREATE INDEX "payload_email_events_created_at_idx" ON ${schema}."payload_email_events" USING btree ("created_at");
  CREATE INDEX "payload_admin_notifications_updated_at_idx" ON ${schema}."payload_admin_notifications" USING btree ("updated_at");
  CREATE INDEX "payload_admin_notifications_created_at_idx" ON ${schema}."payload_admin_notifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_member_groups_slug_idx" ON ${schema}."payload_member_groups" USING btree ("slug");
  CREATE INDEX "payload_member_groups_updated_at_idx" ON ${schema}."payload_member_groups" USING btree ("updated_at");
  CREATE INDEX "payload_member_groups_created_at_idx" ON ${schema}."payload_member_groups" USING btree ("created_at");
  CREATE INDEX "payload_member_groups_rels_order_idx" ON ${schema}."payload_member_groups_rels" USING btree ("order");
  CREATE INDEX "payload_member_groups_rels_parent_idx" ON ${schema}."payload_member_groups_rels" USING btree ("parent_id");
  CREATE INDEX "payload_member_groups_rels_path_idx" ON ${schema}."payload_member_groups_rels" USING btree ("path");
  CREATE INDEX "payload_member_groups_rels_payload_members_id_idx" ON ${schema}."payload_member_groups_rels" USING btree ("payload_members_id");
  CREATE UNIQUE INDEX "payload_spaces_slug_idx" ON ${schema}."payload_spaces" USING btree ("slug");
  CREATE INDEX "payload_spaces_linked_course_idx" ON ${schema}."payload_spaces" USING btree ("linked_course_id");
  CREATE INDEX "payload_spaces_updated_at_idx" ON ${schema}."payload_spaces" USING btree ("updated_at");
  CREATE INDEX "payload_spaces_created_at_idx" ON ${schema}."payload_spaces" USING btree ("created_at");
  CREATE INDEX "payload_spaces_rels_order_idx" ON ${schema}."payload_spaces_rels" USING btree ("order");
  CREATE INDEX "payload_spaces_rels_parent_idx" ON ${schema}."payload_spaces_rels" USING btree ("parent_id");
  CREATE INDEX "payload_spaces_rels_path_idx" ON ${schema}."payload_spaces_rels" USING btree ("path");
  CREATE INDEX "payload_spaces_rels_payload_access_groups_id_idx" ON ${schema}."payload_spaces_rels" USING btree ("payload_access_groups_id");
  CREATE INDEX "payload_space_memberships_member_idx" ON ${schema}."payload_space_memberships" USING btree ("member_id");
  CREATE INDEX "payload_space_memberships_space_idx" ON ${schema}."payload_space_memberships" USING btree ("space_id");
  CREATE INDEX "payload_space_memberships_updated_at_idx" ON ${schema}."payload_space_memberships" USING btree ("updated_at");
  CREATE INDEX "payload_space_memberships_created_at_idx" ON ${schema}."payload_space_memberships" USING btree ("created_at");
  CREATE INDEX "payload_space_posts_space_idx" ON ${schema}."payload_space_posts" USING btree ("space_id");
  CREATE INDEX "payload_space_posts_author_idx" ON ${schema}."payload_space_posts" USING btree ("author_id");
  CREATE INDEX "payload_space_posts_updated_at_idx" ON ${schema}."payload_space_posts" USING btree ("updated_at");
  CREATE INDEX "payload_space_posts_created_at_idx" ON ${schema}."payload_space_posts" USING btree ("created_at");
  CREATE INDEX "payload_space_comments_post_idx" ON ${schema}."payload_space_comments" USING btree ("post_id");
  CREATE INDEX "payload_space_comments_author_idx" ON ${schema}."payload_space_comments" USING btree ("author_id");
  CREATE INDEX "payload_space_comments_updated_at_idx" ON ${schema}."payload_space_comments" USING btree ("updated_at");
  CREATE INDEX "payload_space_comments_created_at_idx" ON ${schema}."payload_space_comments" USING btree ("created_at");
  CREATE INDEX "payload_space_files_space_idx" ON ${schema}."payload_space_files" USING btree ("space_id");
  CREATE INDEX "payload_space_files_uploaded_by_idx" ON ${schema}."payload_space_files" USING btree ("uploaded_by_id");
  CREATE INDEX "payload_space_files_file_idx" ON ${schema}."payload_space_files" USING btree ("file_id");
  CREATE INDEX "payload_space_files_updated_at_idx" ON ${schema}."payload_space_files" USING btree ("updated_at");
  CREATE INDEX "payload_space_files_created_at_idx" ON ${schema}."payload_space_files" USING btree ("created_at");
  CREATE INDEX "payload_chat_threads_space_idx" ON ${schema}."payload_chat_threads" USING btree ("space_id");
  CREATE INDEX "payload_chat_threads_updated_at_idx" ON ${schema}."payload_chat_threads" USING btree ("updated_at");
  CREATE INDEX "payload_chat_threads_created_at_idx" ON ${schema}."payload_chat_threads" USING btree ("created_at");
  CREATE INDEX "payload_chat_threads_rels_order_idx" ON ${schema}."payload_chat_threads_rels" USING btree ("order");
  CREATE INDEX "payload_chat_threads_rels_parent_idx" ON ${schema}."payload_chat_threads_rels" USING btree ("parent_id");
  CREATE INDEX "payload_chat_threads_rels_path_idx" ON ${schema}."payload_chat_threads_rels" USING btree ("path");
  CREATE INDEX "payload_chat_threads_rels_payload_members_id_idx" ON ${schema}."payload_chat_threads_rels" USING btree ("payload_members_id");
  CREATE INDEX "payload_chat_messages_thread_idx" ON ${schema}."payload_chat_messages" USING btree ("thread_id");
  CREATE INDEX "payload_chat_messages_author_idx" ON ${schema}."payload_chat_messages" USING btree ("author_id");
  CREATE INDEX "payload_chat_messages_updated_at_idx" ON ${schema}."payload_chat_messages" USING btree ("updated_at");
  CREATE INDEX "payload_chat_messages_created_at_idx" ON ${schema}."payload_chat_messages" USING btree ("created_at");
  CREATE INDEX "payload_audit_events_actor_id_idx" ON ${schema}."payload_audit_events" USING btree ("actor_id");
  CREATE INDEX "payload_audit_events_action_idx" ON ${schema}."payload_audit_events" USING btree ("action");
  CREATE INDEX "payload_audit_events_target_collection_idx" ON ${schema}."payload_audit_events" USING btree ("target_collection");
  CREATE INDEX "payload_audit_events_target_id_idx" ON ${schema}."payload_audit_events" USING btree ("target_id");
  CREATE INDEX "payload_audit_events_updated_at_idx" ON ${schema}."payload_audit_events" USING btree ("updated_at");
  CREATE INDEX "payload_audit_events_created_at_idx" ON ${schema}."payload_audit_events" USING btree ("created_at");
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_courses_fk" FOREIGN KEY ("payload_courses_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_course_modules_fk" FOREIGN KEY ("payload_course_modules_id") REFERENCES ${schema}."payload_course_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_lessons_fk" FOREIGN KEY ("payload_lessons_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_course_access_previ_fk" FOREIGN KEY ("payload_course_access_preview_id") REFERENCES ${schema}."payload_course_access_preview"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_members_fk" FOREIGN KEY ("payload_members_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_member_profiles_fk" FOREIGN KEY ("payload_member_profiles_id") REFERENCES ${schema}."payload_member_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_member_security_eve_fk" FOREIGN KEY ("payload_member_security_events_id") REFERENCES ${schema}."payload_member_security_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_lesson_resources_fk" FOREIGN KEY ("payload_lesson_resources_id") REFERENCES ${schema}."payload_lesson_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_course_enrollments_fk" FOREIGN KEY ("payload_course_enrollments_id") REFERENCES ${schema}."payload_course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_lesson_progress_fk" FOREIGN KEY ("payload_lesson_progress_id") REFERENCES ${schema}."payload_lesson_progress"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_access_groups_fk" FOREIGN KEY ("payload_access_groups_id") REFERENCES ${schema}."payload_access_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_access_policies_fk" FOREIGN KEY ("payload_access_policies_id") REFERENCES ${schema}."payload_access_policies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_access_grants_fk" FOREIGN KEY ("payload_access_grants_id") REFERENCES ${schema}."payload_access_grants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_entitlement_events_fk" FOREIGN KEY ("payload_entitlement_events_id") REFERENCES ${schema}."payload_entitlement_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_billing_accounts_fk" FOREIGN KEY ("payload_billing_accounts_id") REFERENCES ${schema}."payload_billing_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_subscriptions_fk" FOREIGN KEY ("payload_subscriptions_id") REFERENCES ${schema}."payload_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_payments_fk" FOREIGN KEY ("payload_payments_id") REFERENCES ${schema}."payload_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_stripe_events_fk" FOREIGN KEY ("payload_stripe_events_id") REFERENCES ${schema}."payload_stripe_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_billing_actions_fk" FOREIGN KEY ("payload_billing_actions_id") REFERENCES ${schema}."payload_billing_actions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_contacts_fk" FOREIGN KEY ("payload_contacts_id") REFERENCES ${schema}."payload_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_crm_tags_fk" FOREIGN KEY ("payload_crm_tags_id") REFERENCES ${schema}."payload_crm_tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_contact_tags_fk" FOREIGN KEY ("payload_contact_tags_id") REFERENCES ${schema}."payload_contact_tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_contact_notes_fk" FOREIGN KEY ("payload_contact_notes_id") REFERENCES ${schema}."payload_contact_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_email_templates_fk" FOREIGN KEY ("payload_email_templates_id") REFERENCES ${schema}."payload_email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_email_events_fk" FOREIGN KEY ("payload_email_events_id") REFERENCES ${schema}."payload_email_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_admin_notifications_fk" FOREIGN KEY ("payload_admin_notifications_id") REFERENCES ${schema}."payload_admin_notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_member_groups_fk" FOREIGN KEY ("payload_member_groups_id") REFERENCES ${schema}."payload_member_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_spaces_fk" FOREIGN KEY ("payload_spaces_id") REFERENCES ${schema}."payload_spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_space_memberships_fk" FOREIGN KEY ("payload_space_memberships_id") REFERENCES ${schema}."payload_space_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_space_posts_fk" FOREIGN KEY ("payload_space_posts_id") REFERENCES ${schema}."payload_space_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_space_comments_fk" FOREIGN KEY ("payload_space_comments_id") REFERENCES ${schema}."payload_space_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_space_files_fk" FOREIGN KEY ("payload_space_files_id") REFERENCES ${schema}."payload_space_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_chat_threads_fk" FOREIGN KEY ("payload_chat_threads_id") REFERENCES ${schema}."payload_chat_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_chat_messages_fk" FOREIGN KEY ("payload_chat_messages_id") REFERENCES ${schema}."payload_chat_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_audit_events_fk" FOREIGN KEY ("payload_audit_events_id") REFERENCES ${schema}."payload_audit_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_members_fk" FOREIGN KEY ("payload_members_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payload_courses_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_courses_id");
  CREATE INDEX "payload_locked_documents_rels_payload_course_modules_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_course_modules_id");
  CREATE INDEX "payload_locked_documents_rels_payload_lessons_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_lessons_id");
  CREATE INDEX "payload_locked_documents_rels_payload_course_access_prev_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_course_access_preview_id");
  CREATE INDEX "payload_locked_documents_rels_payload_members_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_members_id");
  CREATE INDEX "payload_locked_documents_rels_payload_member_profiles_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_member_profiles_id");
  CREATE INDEX "payload_locked_documents_rels_payload_member_security_ev_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_member_security_events_id");
  CREATE INDEX "payload_locked_documents_rels_payload_lesson_resources_i_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_lesson_resources_id");
  CREATE INDEX "payload_locked_documents_rels_payload_course_enrollments_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_course_enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_payload_lesson_progress_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_lesson_progress_id");
  CREATE INDEX "payload_locked_documents_rels_payload_access_groups_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_access_groups_id");
  CREATE INDEX "payload_locked_documents_rels_payload_access_policies_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_access_policies_id");
  CREATE INDEX "payload_locked_documents_rels_payload_access_grants_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_access_grants_id");
  CREATE INDEX "payload_locked_documents_rels_payload_entitlement_events_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_entitlement_events_id");
  CREATE INDEX "payload_locked_documents_rels_payload_billing_accounts_i_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_billing_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_subscriptions_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_payload_payments_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_payments_id");
  CREATE INDEX "payload_locked_documents_rels_payload_stripe_events_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_stripe_events_id");
  CREATE INDEX "payload_locked_documents_rels_payload_billing_actions_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_billing_actions_id");
  CREATE INDEX "payload_locked_documents_rels_payload_contacts_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_contacts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_crm_tags_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_crm_tags_id");
  CREATE INDEX "payload_locked_documents_rels_payload_contact_tags_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_contact_tags_id");
  CREATE INDEX "payload_locked_documents_rels_payload_contact_notes_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_contact_notes_id");
  CREATE INDEX "payload_locked_documents_rels_payload_email_templates_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_email_templates_id");
  CREATE INDEX "payload_locked_documents_rels_payload_email_events_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_email_events_id");
  CREATE INDEX "payload_locked_documents_rels_payload_admin_notification_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_admin_notifications_id");
  CREATE INDEX "payload_locked_documents_rels_payload_member_groups_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_member_groups_id");
  CREATE INDEX "payload_locked_documents_rels_payload_spaces_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_spaces_id");
  CREATE INDEX "payload_locked_documents_rels_payload_space_memberships__idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_space_memberships_id");
  CREATE INDEX "payload_locked_documents_rels_payload_space_posts_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_space_posts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_space_comments_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_space_comments_id");
  CREATE INDEX "payload_locked_documents_rels_payload_space_files_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_space_files_id");
  CREATE INDEX "payload_locked_documents_rels_payload_chat_threads_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_chat_threads_id");
  CREATE INDEX "payload_locked_documents_rels_payload_chat_messages_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_chat_messages_id");
  CREATE INDEX "payload_locked_documents_rels_payload_audit_events_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_audit_events_id");
  CREATE INDEX "payload_preferences_rels_payload_members_id_idx" ON ${schema}."payload_preferences_rels" USING btree ("payload_members_id");`))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
   ALTER TABLE ${schema}."payload_courses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_course_modules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_lessons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_lessons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_course_access_preview" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_members_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_member_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_member_security_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_lesson_resources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_course_enrollments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_lesson_progress" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_groups_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_policies_allowed_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_policies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_policies_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_access_grants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_entitlement_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_billing_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_stripe_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_billing_actions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_crm_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_contact_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_contact_notes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_email_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_email_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_admin_notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_member_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_member_groups_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_spaces" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_spaces_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_space_memberships" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_space_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_space_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_space_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_chat_threads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_chat_threads_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_chat_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_audit_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE ${schema}."payload_courses" CASCADE;
  DROP TABLE ${schema}."payload_course_modules" CASCADE;
  DROP TABLE ${schema}."payload_lessons" CASCADE;
  DROP TABLE ${schema}."payload_lessons_rels" CASCADE;
  DROP TABLE ${schema}."payload_course_access_preview" CASCADE;
  DROP TABLE ${schema}."payload_members_sessions" CASCADE;
  DROP TABLE ${schema}."payload_members" CASCADE;
  DROP TABLE ${schema}."payload_member_profiles" CASCADE;
  DROP TABLE ${schema}."payload_member_security_events" CASCADE;
  DROP TABLE ${schema}."payload_lesson_resources" CASCADE;
  DROP TABLE ${schema}."payload_course_enrollments" CASCADE;
  DROP TABLE ${schema}."payload_lesson_progress" CASCADE;
  DROP TABLE ${schema}."payload_access_groups" CASCADE;
  DROP TABLE ${schema}."payload_access_groups_rels" CASCADE;
  DROP TABLE ${schema}."payload_access_policies_allowed_plans" CASCADE;
  DROP TABLE ${schema}."payload_access_policies" CASCADE;
  DROP TABLE ${schema}."payload_access_policies_rels" CASCADE;
  DROP TABLE ${schema}."payload_access_grants" CASCADE;
  DROP TABLE ${schema}."payload_entitlement_events" CASCADE;
  DROP TABLE ${schema}."payload_billing_accounts" CASCADE;
  DROP TABLE ${schema}."payload_subscriptions" CASCADE;
  DROP TABLE ${schema}."payload_payments" CASCADE;
  DROP TABLE ${schema}."payload_stripe_events" CASCADE;
  DROP TABLE ${schema}."payload_billing_actions" CASCADE;
  DROP TABLE ${schema}."payload_contacts" CASCADE;
  DROP TABLE ${schema}."payload_crm_tags" CASCADE;
  DROP TABLE ${schema}."payload_contact_tags" CASCADE;
  DROP TABLE ${schema}."payload_contact_notes" CASCADE;
  DROP TABLE ${schema}."payload_email_templates" CASCADE;
  DROP TABLE ${schema}."payload_email_events" CASCADE;
  DROP TABLE ${schema}."payload_admin_notifications" CASCADE;
  DROP TABLE ${schema}."payload_member_groups" CASCADE;
  DROP TABLE ${schema}."payload_member_groups_rels" CASCADE;
  DROP TABLE ${schema}."payload_spaces" CASCADE;
  DROP TABLE ${schema}."payload_spaces_rels" CASCADE;
  DROP TABLE ${schema}."payload_space_memberships" CASCADE;
  DROP TABLE ${schema}."payload_space_posts" CASCADE;
  DROP TABLE ${schema}."payload_space_comments" CASCADE;
  DROP TABLE ${schema}."payload_space_files" CASCADE;
  DROP TABLE ${schema}."payload_chat_threads" CASCADE;
  DROP TABLE ${schema}."payload_chat_threads_rels" CASCADE;
  DROP TABLE ${schema}."payload_chat_messages" CASCADE;
  DROP TABLE ${schema}."payload_audit_events" CASCADE;
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_courses_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_course_modules_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_lessons_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_course_access_previ_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_members_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_member_profiles_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_member_security_eve_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_lesson_resources_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_course_enrollments_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_lesson_progress_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_access_groups_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_access_policies_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_access_grants_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_entitlement_events_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_billing_accounts_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_subscriptions_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_payments_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_stripe_events_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_billing_actions_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_contacts_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_crm_tags_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_contact_tags_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_contact_notes_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_email_templates_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_email_events_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_admin_notifications_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_member_groups_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_spaces_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_space_memberships_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_space_posts_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_space_comments_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_space_files_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_chat_threads_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_chat_messages_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_audit_events_fk";
  
  ALTER TABLE ${schema}."payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_payload_members_fk";
  
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_courses_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_course_modules_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_lessons_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_course_access_prev_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_members_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_member_profiles_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_member_security_ev_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_lesson_resources_i_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_course_enrollments_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_lesson_progress_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_access_groups_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_access_policies_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_access_grants_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_entitlement_events_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_billing_accounts_i_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_subscriptions_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_payments_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_stripe_events_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_billing_actions_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_contacts_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_crm_tags_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_contact_tags_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_contact_notes_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_email_templates_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_email_events_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_admin_notification_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_member_groups_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_spaces_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_space_memberships__idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_space_posts_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_space_comments_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_space_files_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_chat_threads_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_chat_messages_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_audit_events_id_idx";
  DROP INDEX ${schema}."payload_preferences_rels_payload_members_id_idx";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_courses_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_course_modules_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_lessons_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_course_access_preview_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_members_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_member_profiles_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_member_security_events_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_lesson_resources_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_course_enrollments_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_lesson_progress_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_access_groups_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_access_policies_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_access_grants_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_entitlement_events_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_billing_accounts_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_subscriptions_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_payments_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_stripe_events_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_billing_actions_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_contacts_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_crm_tags_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_contact_tags_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_contact_notes_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_email_templates_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_email_events_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_admin_notifications_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_member_groups_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_spaces_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_space_memberships_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_space_posts_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_space_comments_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_space_files_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_chat_threads_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_chat_messages_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_audit_events_id";
  ALTER TABLE ${schema}."payload_preferences_rels" DROP COLUMN "payload_members_id";
  DROP TYPE ${schema}."enum_payload_courses_status";
  DROP TYPE ${schema}."enum_payload_courses_visibility";
  DROP TYPE ${schema}."enum_payload_courses_access_badge";
  DROP TYPE ${schema}."enum_payload_lessons_video_provider_label";
  DROP TYPE ${schema}."enum_payload_lessons_mock_completion_state";
  DROP TYPE ${schema}."enum_payload_lessons_visual_lock_state";
  DROP TYPE ${schema}."enum_payload_course_access_preview_type";
  DROP TYPE ${schema}."enum_payload_course_access_preview_visual_state";
  DROP TYPE ${schema}."enum_payload_members_account_status";
  DROP TYPE ${schema}."enum_payload_members_source";
  DROP TYPE ${schema}."enum_payload_member_security_events_event_type";
  DROP TYPE ${schema}."enum_payload_lesson_resources_status";
  DROP TYPE ${schema}."enum_payload_course_enrollments_status";
  DROP TYPE ${schema}."enum_payload_course_enrollments_source";
  DROP TYPE ${schema}."enum_payload_lesson_progress_status";
  DROP TYPE ${schema}."enum_payload_access_groups_status";
  DROP TYPE ${schema}."enum_payload_access_groups_group_type";
  DROP TYPE ${schema}."enum_payload_access_policies_allowed_plans";
  DROP TYPE ${schema}."enum_payload_access_policies_status";
  DROP TYPE ${schema}."enum_payload_access_policies_resource_type";
  DROP TYPE ${schema}."enum_payload_access_policies_privacy";
  DROP TYPE ${schema}."enum_payload_access_grants_resource_type";
  DROP TYPE ${schema}."enum_payload_access_grants_status";
  DROP TYPE ${schema}."enum_payload_access_grants_source";
  DROP TYPE ${schema}."enum_payload_entitlement_events_event_type";
  DROP TYPE ${schema}."enum_payload_entitlement_events_resource_type";
  DROP TYPE ${schema}."enum_payload_entitlement_events_result";
  DROP TYPE ${schema}."enum_payload_billing_accounts_stripe_mode";
  DROP TYPE ${schema}."enum_payload_billing_accounts_billing_status";
  DROP TYPE ${schema}."enum_payload_subscriptions_plan";
  DROP TYPE ${schema}."enum_payload_subscriptions_status";
  DROP TYPE ${schema}."enum_payload_payments_status";
  DROP TYPE ${schema}."enum_payload_stripe_events_processing_status";
  DROP TYPE ${schema}."enum_payload_billing_actions_action_type";
  DROP TYPE ${schema}."enum_payload_billing_actions_status";
  DROP TYPE ${schema}."enum_payload_contacts_lifecycle_stage";
  DROP TYPE ${schema}."enum_payload_contacts_email_status";
  DROP TYPE ${schema}."enum_payload_crm_tags_status";
  DROP TYPE ${schema}."enum_payload_contact_tags_source";
  DROP TYPE ${schema}."enum_payload_contact_notes_note_type";
  DROP TYPE ${schema}."enum_payload_email_templates_status";
  DROP TYPE ${schema}."enum_payload_email_templates_purpose";
  DROP TYPE ${schema}."enum_payload_email_events_delivery_status";
  DROP TYPE ${schema}."enum_payload_admin_notifications_notification_type";
  DROP TYPE ${schema}."enum_payload_admin_notifications_severity";
  DROP TYPE ${schema}."enum_payload_admin_notifications_status";
  DROP TYPE ${schema}."enum_payload_member_groups_status";
  DROP TYPE ${schema}."enum_payload_member_groups_visibility";
  DROP TYPE ${schema}."enum_payload_spaces_status";
  DROP TYPE ${schema}."enum_payload_spaces_space_type";
  DROP TYPE ${schema}."enum_payload_spaces_visibility";
  DROP TYPE ${schema}."enum_payload_space_memberships_role";
  DROP TYPE ${schema}."enum_payload_space_memberships_status";
  DROP TYPE ${schema}."enum_payload_space_posts_post_type";
  DROP TYPE ${schema}."enum_payload_space_posts_moderation_status";
  DROP TYPE ${schema}."enum_payload_space_comments_moderation_status";
  DROP TYPE ${schema}."enum_payload_space_files_moderation_status";
  DROP TYPE ${schema}."enum_payload_chat_threads_status";
  DROP TYPE ${schema}."enum_payload_chat_messages_moderation_status";
  DROP TYPE ${schema}."enum_payload_audit_events_actor_type";
  DROP TYPE ${schema}."enum_payload_audit_events_severity";`))
}
