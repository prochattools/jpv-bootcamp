import { quotePgIdentifier } from './payloadMigrationSchema'

const defaultPayloadSchema = 'jpvbootcamp'
const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

export function getAffiliateReportingMigrationSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (databaseUrl == null || databaseUrl === '') {
    return defaultPayloadSchema
  }

  let schema: string | null

  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error(`Malformed DATABASE_URL: ${databaseUrl}`)
  }

  const resolved = schema || defaultPayloadSchema

  if (!schemaIdentifierPattern.test(resolved)) {
    throw new Error(`Invalid Payload migration schema: ${resolved}`)
  }

  return resolved
}

function getAffiliateReportingMigrationSchemaSqlPrefix(databaseUrl = process.env.DATABASE_URL): string {
  return quotePgIdentifier(getAffiliateReportingMigrationSchema(databaseUrl))
}

export function buildAffiliateReportingMigrationUpSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getAffiliateReportingMigrationSchemaSqlPrefix(databaseUrl)

  return `
   CREATE TYPE ${schema}."enum_payload_affiliates_status" AS ENUM('pending', 'active', 'suspended');
  CREATE TYPE ${schema}."enum_payload_affiliate_referrals_status" AS ENUM('tracked', 'converted', 'rejected');
  CREATE TYPE ${schema}."enum_payload_affiliate_commissions_status" AS ENUM('pending', 'approved', 'void');
  CREATE TABLE ${schema}."payload_affiliates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"referral_code" varchar NOT NULL,
  	"status" ${schema}."enum_payload_affiliates_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_affiliate_referrals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"affiliate_id" integer NOT NULL,
  	"referred_member_id" integer,
  	"status" ${schema}."enum_payload_affiliate_referrals_status" DEFAULT 'tracked' NOT NULL,
  	"converted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE ${schema}."payload_affiliate_commissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"affiliate_id" integer NOT NULL,
  	"referral_id" integer NOT NULL,
  	"amount_minor" numeric NOT NULL,
  	"currency" varchar DEFAULT 'USD' NOT NULL,
  	"status" ${schema}."enum_payload_affiliate_commissions_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	CONSTRAINT "payload_affiliate_commissions_amount_minor_check" CHECK ("amount_minor" >= 0 AND "amount_minor" = trunc("amount_minor"))
  );
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_affiliates_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_affiliate_referrals_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_affiliate_commissions_id" integer;
  ALTER TABLE ${schema}."payload_affiliates" ADD CONSTRAINT "payload_affiliates_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE ${schema}."payload_affiliate_referrals" ADD CONSTRAINT "payload_affiliate_referrals_affiliate_id_payload_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES ${schema}."payload_affiliates"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE ${schema}."payload_affiliate_referrals" ADD CONSTRAINT "payload_affiliate_referrals_referred_member_id_payload_members_id_fk" FOREIGN KEY ("referred_member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_affiliate_commissions" ADD CONSTRAINT "payload_affiliate_commissions_affiliate_id_payload_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES ${schema}."payload_affiliates"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE ${schema}."payload_affiliate_commissions" ADD CONSTRAINT "payload_affiliate_commissions_referral_id_payload_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES ${schema}."payload_affiliate_referrals"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "payload_affiliates_member_idx" ON ${schema}."payload_affiliates" USING btree ("member_id");
  CREATE UNIQUE INDEX "payload_affiliates_referral_code_idx" ON ${schema}."payload_affiliates" USING btree ("referral_code");
  CREATE INDEX "payload_affiliates_updated_at_idx" ON ${schema}."payload_affiliates" USING btree ("updated_at");
  CREATE INDEX "payload_affiliates_created_at_idx" ON ${schema}."payload_affiliates" USING btree ("created_at");
  CREATE INDEX "payload_affiliate_referrals_affiliate_idx" ON ${schema}."payload_affiliate_referrals" USING btree ("affiliate_id");
  CREATE INDEX "payload_affiliate_referrals_referred_member_idx" ON ${schema}."payload_affiliate_referrals" USING btree ("referred_member_id");
  CREATE INDEX "payload_affiliate_referrals_updated_at_idx" ON ${schema}."payload_affiliate_referrals" USING btree ("updated_at");
  CREATE INDEX "payload_affiliate_referrals_created_at_idx" ON ${schema}."payload_affiliate_referrals" USING btree ("created_at");
  CREATE INDEX "payload_affiliate_commissions_affiliate_idx" ON ${schema}."payload_affiliate_commissions" USING btree ("affiliate_id");
  CREATE INDEX "payload_affiliate_commissions_referral_idx" ON ${schema}."payload_affiliate_commissions" USING btree ("referral_id");
  CREATE INDEX "payload_affiliate_commissions_updated_at_idx" ON ${schema}."payload_affiliate_commissions" USING btree ("updated_at");
  CREATE INDEX "payload_affiliate_commissions_created_at_idx" ON ${schema}."payload_affiliate_commissions" USING btree ("created_at");
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliates_fk" FOREIGN KEY ("payload_affiliates_id") REFERENCES ${schema}."payload_affiliates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliate_referrals_fk" FOREIGN KEY ("payload_affiliate_referrals_id") REFERENCES ${schema}."payload_affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_affiliate_commissio_fk" FOREIGN KEY ("payload_affiliate_commissions_id") REFERENCES ${schema}."payload_affiliate_commissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payload_affiliates_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_affiliates_id");
  CREATE INDEX "payload_locked_documents_rels_payload_affiliate_referral_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_affiliate_referrals_id");
  CREATE INDEX "payload_locked_documents_rels_payload_affiliate_commissi_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_affiliate_commissions_id");`
}

export function buildAffiliateReportingMigrationDownSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getAffiliateReportingMigrationSchemaSqlPrefix(databaseUrl)

  return `
   ALTER TABLE ${schema}."payload_affiliates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_affiliate_referrals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_affiliate_commissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE ${schema}."payload_affiliates" CASCADE;
  DROP TABLE ${schema}."payload_affiliate_referrals" CASCADE;
  DROP TABLE ${schema}."payload_affiliate_commissions" CASCADE;
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliates_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliate_referrals_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_affiliate_commissio_fk";
  
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_affiliates_id_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_affiliate_referral_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_affiliate_commissi_idx";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_affiliates_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_affiliate_referrals_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_affiliate_commissions_id";
  DROP TYPE ${schema}."enum_payload_affiliates_status";
  DROP TYPE ${schema}."enum_payload_affiliate_referrals_status";
  DROP TYPE ${schema}."enum_payload_affiliate_commissions_status";`
}
