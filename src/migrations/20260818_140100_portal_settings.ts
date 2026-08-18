import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TABLE ${schema}."portal_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "site_title" varchar DEFAULT 'JPV Bootcamp' NOT NULL,
  "logo_id" integer,
  "white_logo_id" integer,
  "featured_image_id" integer,
  "login_banner_title" varchar DEFAULT 'Welcome to JPV Bootcamp - Portal',
  "login_banner_description" varchar DEFAULT 'Join our community and start your journey to success',
  "login_banner_title_color" varchar DEFAULT '#19283a',
  "login_banner_text_color" varchar DEFAULT '#525866',
  "login_banner_background_color" varchar DEFAULT '#F5F7FA',
  "login_banner_logo_id" integer,
  "login_banner_background_image_id" integer,
  "login_form_title" varchar DEFAULT 'Login to JPV Bootcamp - Portal',
  "login_form_description" varchar DEFAULT 'Enter your email and password to login',
  "login_form_title_color" varchar DEFAULT '#19283a',
  "login_form_text_color" varchar DEFAULT '#525866',
  "login_form_background_color" varchar DEFAULT '#ffffff',
  "login_form_button_label" varchar DEFAULT 'Login',
  "login_form_button_color" varchar DEFAULT '#2B2E33',
  "login_form_button_label_color" varchar DEFAULT '#ffffff',
  "login_form_background_image_id" integer,
  "legacy_settings" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_logo_id_payload_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_white_logo_id_payload_media_id_fk" FOREIGN KEY ("white_logo_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_featured_image_id_payload_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_login_banner_logo_id_payload_media_id_fk" FOREIGN KEY ("login_banner_logo_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_login_banner_background_image_id_payload_media_id_fk" FOREIGN KEY ("login_banner_background_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."portal_settings" ADD CONSTRAINT "portal_settings_login_form_background_image_id_payload_media_id_fk" FOREIGN KEY ("login_form_background_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "portal_settings_logo_idx" ON ${schema}."portal_settings" USING btree ("logo_id");
CREATE INDEX "portal_settings_white_logo_idx" ON ${schema}."portal_settings" USING btree ("white_logo_id");
CREATE INDEX "portal_settings_featured_image_idx" ON ${schema}."portal_settings" USING btree ("featured_image_id");
CREATE INDEX "portal_settings_login_banner_logo_idx" ON ${schema}."portal_settings" USING btree ("login_banner_logo_id");
CREATE INDEX "portal_settings_login_banner_background_image_idx" ON ${schema}."portal_settings" USING btree ("login_banner_background_image_id");
CREATE INDEX "portal_settings_login_form_background_image_idx" ON ${schema}."portal_settings" USING btree ("login_form_background_image_id");
CREATE INDEX "portal_settings_updated_at_idx" ON ${schema}."portal_settings" USING btree ("updated_at");
CREATE INDEX "portal_settings_created_at_idx" ON ${schema}."portal_settings" USING btree ("created_at");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."portal_settings" LIMIT 1) THEN
    RAISE EXCEPTION 'portal_settings_rollback_blocked_populated_table';
  END IF;
END $$;
DROP TABLE IF EXISTS ${schema}."portal_settings";
`))
}
