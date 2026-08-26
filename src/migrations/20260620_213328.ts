import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
   CREATE TYPE ${schema}."enum_payload_posts_status" AS ENUM('draft', 'published');
  CREATE TABLE ${schema}."payload_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_users" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  
  CREATE TABLE ${schema}."payload_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE ${schema}."payload_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"content" jsonb,
	"status" ${schema}."enum_payload_posts_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_categories_id" integer
  );
  
  CREATE TABLE ${schema}."payload_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_users_id" integer,
  	"payload_media_id" integer,
  	"payload_pages_id" integer,
  	"payload_posts_id" integer,
  	"payload_categories_id" integer
  );
  
  CREATE TABLE ${schema}."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"payload_users_id" integer
  );
  
  CREATE TABLE ${schema}."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE ${schema}."payload_users_sessions" ADD CONSTRAINT "payload_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES ${schema}."payload_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_posts_rels" ADD CONSTRAINT "payload_posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_posts_rels" ADD CONSTRAINT "payload_posts_rels_payload_categories_fk" FOREIGN KEY ("payload_categories_id") REFERENCES ${schema}."payload_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_users_fk" FOREIGN KEY ("payload_users_id") REFERENCES ${schema}."payload_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_media_fk" FOREIGN KEY ("payload_media_id") REFERENCES ${schema}."payload_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_pages_fk" FOREIGN KEY ("payload_pages_id") REFERENCES ${schema}."payload_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_posts_fk" FOREIGN KEY ("payload_posts_id") REFERENCES ${schema}."payload_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_categories_fk" FOREIGN KEY ("payload_categories_id") REFERENCES ${schema}."payload_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_users_fk" FOREIGN KEY ("payload_users_id") REFERENCES ${schema}."payload_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_users_sessions_order_idx" ON ${schema}."payload_users_sessions" USING btree ("_order");
  CREATE INDEX "payload_users_sessions_parent_id_idx" ON ${schema}."payload_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "payload_users_updated_at_idx" ON ${schema}."payload_users" USING btree ("updated_at");
  CREATE INDEX "payload_users_created_at_idx" ON ${schema}."payload_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_users_email_idx" ON ${schema}."payload_users" USING btree ("email");
  CREATE INDEX "payload_media_updated_at_idx" ON ${schema}."payload_media" USING btree ("updated_at");
  CREATE INDEX "payload_media_created_at_idx" ON ${schema}."payload_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_media_filename_idx" ON ${schema}."payload_media" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_pages_slug_idx" ON ${schema}."payload_pages" USING btree ("slug");
  CREATE INDEX "payload_pages_updated_at_idx" ON ${schema}."payload_pages" USING btree ("updated_at");
  CREATE INDEX "payload_pages_created_at_idx" ON ${schema}."payload_pages" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_posts_slug_idx" ON ${schema}."payload_posts" USING btree ("slug");
  CREATE INDEX "payload_posts_updated_at_idx" ON ${schema}."payload_posts" USING btree ("updated_at");
  CREATE INDEX "payload_posts_created_at_idx" ON ${schema}."payload_posts" USING btree ("created_at");
  CREATE INDEX "payload_posts_rels_order_idx" ON ${schema}."payload_posts_rels" USING btree ("order");
  CREATE INDEX "payload_posts_rels_parent_idx" ON ${schema}."payload_posts_rels" USING btree ("parent_id");
  CREATE INDEX "payload_posts_rels_path_idx" ON ${schema}."payload_posts_rels" USING btree ("path");
  CREATE INDEX "payload_posts_rels_payload_categories_id_idx" ON ${schema}."payload_posts_rels" USING btree ("payload_categories_id");
  CREATE INDEX "payload_categories_updated_at_idx" ON ${schema}."payload_categories" USING btree ("updated_at");
  CREATE INDEX "payload_categories_created_at_idx" ON ${schema}."payload_categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON ${schema}."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON ${schema}."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON ${schema}."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON ${schema}."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_payload_users_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_users_id");
  CREATE INDEX "payload_locked_documents_rels_payload_media_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_media_id");
  CREATE INDEX "payload_locked_documents_rels_payload_pages_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_pages_id");
  CREATE INDEX "payload_locked_documents_rels_payload_posts_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_posts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_categories_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_categories_id");
  CREATE INDEX "payload_preferences_key_idx" ON ${schema}."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON ${schema}."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON ${schema}."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON ${schema}."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON ${schema}."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON ${schema}."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_payload_users_id_idx" ON ${schema}."payload_preferences_rels" USING btree ("payload_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON ${schema}."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON ${schema}."payload_migrations" USING btree ("created_at");`))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
   DROP TABLE ${schema}."payload_users_sessions" CASCADE;
  DROP TABLE ${schema}."payload_users" CASCADE;
  DROP TABLE ${schema}."payload_media" CASCADE;
  DROP TABLE ${schema}."payload_pages" CASCADE;
  DROP TABLE ${schema}."payload_posts" CASCADE;
  DROP TABLE ${schema}."payload_posts_rels" CASCADE;
  DROP TABLE ${schema}."payload_categories" CASCADE;
  DROP TABLE ${schema}."payload_kv" CASCADE;
  DROP TABLE ${schema}."payload_locked_documents" CASCADE;
  DROP TABLE ${schema}."payload_locked_documents_rels" CASCADE;
  DROP TABLE ${schema}."payload_preferences" CASCADE;
  DROP TABLE ${schema}."payload_preferences_rels" CASCADE;
  DROP TABLE ${schema}."payload_migrations" CASCADE;
  DROP TYPE ${schema}."enum_payload_posts_status";`))
}
