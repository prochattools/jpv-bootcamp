import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "jpvbootcamp"."enum_payload_affiliates_status" AS ENUM('pending', 'active', 'suspended');
  CREATE TYPE "jpvbootcamp"."enum_payload_affiliate_referrals_status" AS ENUM('tracked', 'converted', 'rejected');
  CREATE TYPE "jpvbootcamp"."enum_payload_affiliate_commissions_status" AS ENUM('pending', 'approved', 'void');
  CREATE TABLE "jpvbootcamp"."payload_affiliates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"referral_code" varchar NOT NULL,
  	"status" "jpvbootcamp"."enum_payload_affiliates_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "jpvbootcamp"."payload_affiliate_referrals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"affiliate_id" integer NOT NULL,
  	"referred_member_id" integer,
  	"status" "jpvbootcamp"."enum_payload_affiliate_referrals_status" DEFAULT 'tracked' NOT NULL,
  	"converted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "jpvbootcamp"."payload_affiliate_commissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"affiliate_id" integer NOT NULL,
  	"referral_id" integer NOT NULL,
  	"amount_minor" numeric NOT NULL,
  	"currency" varchar DEFAULT 'USD' NOT NULL,
  	"status" "jpvbootcamp"."enum_payload_affiliate_commissions_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	CONSTRAINT "payload_affiliate_commissions_amount_minor_check" CHECK ("amount_minor" >= 0 AND "amount_minor" = trunc("amount_minor"))
  );
  
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD COLUMN "payload_affiliates_id" integer;
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD COLUMN "payload_affiliate_referrals_id" integer;
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD COLUMN "payload_affiliate_commissions_id" integer;
  ALTER TABLE "jpvbootcamp"."payload_affiliates" ADD CONSTRAINT "payload_affiliates_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "jpvbootcamp"."payload_members"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_referrals" ADD CONSTRAINT "payload_affiliate_referrals_affiliate_id_payload_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "jpvbootcamp"."payload_affiliates"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_referrals" ADD CONSTRAINT "payload_affiliate_referrals_referred_member_id_payload_members_id_fk" FOREIGN KEY ("referred_member_id") REFERENCES "jpvbootcamp"."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_commissions" ADD CONSTRAINT "payload_affiliate_commissions_affiliate_id_payload_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "jpvbootcamp"."payload_affiliates"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_commissions" ADD CONSTRAINT "payload_affiliate_commissions_referral_id_payload_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "jpvbootcamp"."payload_affiliate_referrals"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "payload_affiliates_member_idx" ON "jpvbootcamp"."payload_affiliates" USING btree ("member_id");
  CREATE UNIQUE INDEX "payload_affiliates_referral_code_idx" ON "jpvbootcamp"."payload_affiliates" USING btree ("referral_code");
  CREATE INDEX "payload_affiliates_updated_at_idx" ON "jpvbootcamp"."payload_affiliates" USING btree ("updated_at");
  CREATE INDEX "payload_affiliates_created_at_idx" ON "jpvbootcamp"."payload_affiliates" USING btree ("created_at");
  CREATE INDEX "payload_affiliate_referrals_affiliate_idx" ON "jpvbootcamp"."payload_affiliate_referrals" USING btree ("affiliate_id");
  CREATE INDEX "payload_affiliate_referrals_referred_member_idx" ON "jpvbootcamp"."payload_affiliate_referrals" USING btree ("referred_member_id");
  CREATE INDEX "payload_affiliate_referrals_updated_at_idx" ON "jpvbootcamp"."payload_affiliate_referrals" USING btree ("updated_at");
  CREATE INDEX "payload_affiliate_referrals_created_at_idx" ON "jpvbootcamp"."payload_affiliate_referrals" USING btree ("created_at");
  CREATE INDEX "payload_affiliate_commissions_affiliate_idx" ON "jpvbootcamp"."payload_affiliate_commissions" USING btree ("affiliate_id");
  CREATE INDEX "payload_affiliate_commissions_referral_idx" ON "jpvbootcamp"."payload_affiliate_commissions" USING btree ("referral_id");
  CREATE INDEX "payload_affiliate_commissions_updated_at_idx" ON "jpvbootcamp"."payload_affiliate_commissions" USING btree ("updated_at");
  CREATE INDEX "payload_affiliate_commissions_created_at_idx" ON "jpvbootcamp"."payload_affiliate_commissions" USING btree ("created_at");
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliates_fk" FOREIGN KEY ("payload_affiliates_id") REFERENCES "jpvbootcamp"."payload_affiliates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliate_referrals_fk" FOREIGN KEY ("payload_affiliate_referrals_id") REFERENCES "jpvbootcamp"."payload_affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliate_commissio_fk" FOREIGN KEY ("payload_affiliate_commissions_id") REFERENCES "jpvbootcamp"."payload_affiliate_commissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payload_affiliates_id_idx" ON "jpvbootcamp"."payload_locked_documents_rels" USING btree ("payload_affiliates_id");
  CREATE INDEX "payload_locked_documents_rels_payload_affiliate_referral_idx" ON "jpvbootcamp"."payload_locked_documents_rels" USING btree ("payload_affiliate_referrals_id");
  CREATE INDEX "payload_locked_documents_rels_payload_affiliate_commissi_idx" ON "jpvbootcamp"."payload_locked_documents_rels" USING btree ("payload_affiliate_commissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jpvbootcamp"."payload_affiliates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_referrals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "jpvbootcamp"."payload_affiliate_commissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "jpvbootcamp"."payload_affiliates" CASCADE;
  DROP TABLE "jpvbootcamp"."payload_affiliate_referrals" CASCADE;
  DROP TABLE "jpvbootcamp"."payload_affiliate_commissions" CASCADE;
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliates_fk";
  
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliate_referrals_fk";
  
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliate_commissio_fk";
  
  DROP INDEX "jpvbootcamp"."payload_locked_documents_rels_payload_affiliates_id_idx";
  DROP INDEX "jpvbootcamp"."payload_locked_documents_rels_payload_affiliate_referral_idx";
  DROP INDEX "jpvbootcamp"."payload_locked_documents_rels_payload_affiliate_commissi_idx";
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP COLUMN "payload_affiliates_id";
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP COLUMN "payload_affiliate_referrals_id";
  ALTER TABLE "jpvbootcamp"."payload_locked_documents_rels" DROP COLUMN "payload_affiliate_commissions_id";
  DROP TYPE "jpvbootcamp"."enum_payload_affiliates_status";
  DROP TYPE "jpvbootcamp"."enum_payload_affiliate_referrals_status";
  DROP TYPE "jpvbootcamp"."enum_payload_affiliate_commissions_status";`)
}
