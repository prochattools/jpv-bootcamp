#!/usr/bin/env node
// ProKit – ProChat SaaS Starter
// (c) 2025 Steve Westhoek / ProChat
/**
 * Provision a single-tenant schema + user + registry entry.
 *
 * Flags:
 *   --slug <slug>      (required in prod; defaults to "dev" in development)
 *   --preview          (optional; marks tenant type = "preview")
 *   --external-id <id> (optional; stored in registry)
 *
 * Env:
 *   APP_SLUG            used as a fallback slug
 *   TENANT_DB_PASSWORD  optional override; if not set, a new password is generated
 *   SYSTEM_DATABASE_URL admin connection for provisioning (required in prod)
 */

const { Client } = require('pg')
const crypto = require('node:crypto')
const fs = require('fs')
const path = require('path')

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {
    slug: process.env.APP_SLUG || '',
    preview: false,
    externalId: process.env.EXTERNAL_ID || ''
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--slug' && args[i + 1]) {
      result.slug = args[++i]
    } else if (arg === '--preview') {
      result.preview = true
    } else if (arg === '--external-id' && args[i + 1]) {
      result.externalId = args[++i]
    }
  }

  return result
}

function validateSlug(slug) {
  const safe = /^[a-z0-9_]+$/
  if (!safe.test(slug)) {
    fail(
      `Invalid slug "${slug}". Only lowercase letters, numbers and underscores are allowed.`
    )
  }
}

function isAlphanumeric(value) {
  return /^[a-zA-Z0-9]+$/.test(value)
}

function generatePassword(length = 24) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(length)
  let output = ''
  for (let i = 0; i < length; i++) {
    output += alphabet[bytes[i] % alphabet.length]
  }
  return output
}

function isSafeSchemaName(name) {
  return /^[a-z0-9_]+$/.test(name)
}

function readPrismaSchemas() {
  const prismaPath = path.join(process.cwd(), 'prisma', 'system.prisma')
  if (!fs.existsSync(prismaPath)) return []
  const content = fs.readFileSync(prismaPath, 'utf8')
  const regex = /@@schema\(["']([^"']+)["']\)/g
  const schemas = new Set()
  let match = null
  while ((match = regex.exec(content))) {
    if (match[1]) {
      schemas.add(match[1])
    }
  }
  schemas.delete('public')
  return Array.from(schemas)
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const lines = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'))

  const map = {}
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    map[key] = value
  }
  return map
}

function persistEnv(envPath, updates) {
  const existing = loadEnvFile(envPath)
  const merged = { ...existing, ...updates }
  const content =
    Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  fs.writeFileSync(envPath, content, { encoding: 'utf8' })
}

async function main() {
  const env = process.env.NODE_ENV || 'development'
  const isProd = env === 'production'
  const envPath = path.join(process.cwd(), '.env')
  const envFile = !isProd ? loadEnvFile(envPath) : {}

  let systemUrl = process.env.SYSTEM_DATABASE_URL
  if (!systemUrl) {
    if (isProd) {
      fail('SYSTEM_DATABASE_URL is required in production')
    } else {
      systemUrl =
        'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'
      console.log(
        'ℹ️ SYSTEM_DATABASE_URL not set, using default local Docker Postgres:',
        systemUrl
      )
    }
  }

  const { slug: rawSlug, preview, externalId } = parseArgs()
  let slug = (rawSlug || '').trim()
  const prismaSchemas = !isProd ? readPrismaSchemas() : []
  const tenantSchemas = prismaSchemas
    .filter((schemaName) => schemaName.startsWith('tenant_'))
    .filter((schemaName) => isSafeSchemaName(schemaName))
  if (!slug || slug === 'dev') {
    if (!isProd && tenantSchemas.length === 1) {
      const derived = tenantSchemas[0].slice('tenant_'.length)
      if (derived && derived !== 'dev') {
        slug = derived
        console.log(`ℹ️ Prisma schema targets ${tenantSchemas[0]}; using slug "${slug}".`)
      }
    }
  }
  if (!slug) {
    if (isProd) {
      fail('No tenant slug provided. Use --slug <slug> or set APP_SLUG.')
    }
    slug = 'dev'
    console.log('ℹ️ No slug provided, defaulting to "dev" in development')
  }
  validateSlug(slug)

  const schema = `tenant_${slug}`
  const user = `${schema}_user`
  const tenantType = preview ? 'preview' : 'prod'
  const extraSchemas =
    !isProd
      ? readPrismaSchemas().filter(
          (schemaName) =>
            schemaName !== 'public' &&
            schemaName !== schema &&
            isSafeSchemaName(schemaName)
        )
      : []

  let password =
    process.env.TENANT_DB_PASSWORD || (!isProd ? envFile.TENANT_DB_PASSWORD : undefined)
  if (password) {
    if (!isAlphanumeric(password)) {
      fail('TENANT_DB_PASSWORD must be alphanumeric only.')
    }
  } else {
    password = generatePassword()
    console.log('ℹ️ TENANT_DB_PASSWORD not set; generated a new tenant password.')
  }

  console.log('--------------------------------------------------')
  console.log(`🚀 Provisioning tenant "${slug}" (${env})`)
  console.log(`Schema: ${schema}`)
  console.log(`User:   ${user}`)
  console.log(`Type:   ${tenantType}`)
  console.log('--------------------------------------------------')

  const client = new Client({ connectionString: systemUrl })

  try {
    await client.connect()

    const extraSchemaSql = extraSchemas
      .map(
        (schemaName) => `
      CREATE SCHEMA IF NOT EXISTS ${schemaName};
      GRANT USAGE ON SCHEMA ${schemaName} TO ${user};
      GRANT ALL PRIVILEGES ON SCHEMA ${schemaName} TO ${user};
    `
      )
      .join('\n')

    const publicGrantSql = isProd
      ? `GRANT USAGE ON SCHEMA public TO ${user};`
      : `
      GRANT USAGE ON SCHEMA public TO ${user};
      GRANT CREATE ON SCHEMA public TO ${user};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${user};
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${user};
    `

    const schemaGrantSql = isProd
      ? `GRANT USAGE ON SCHEMA ${schema} TO ${user};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${user};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON TABLES TO ${user};`
      : `
      GRANT USAGE ON SCHEMA ${schema} TO ${user};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${user};
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON TABLES TO ${user};
    `

    const ddlSql = `
      CREATE SCHEMA IF NOT EXISTS ${schema};

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM pg_catalog.pg_roles WHERE rolname = '${user}'
        ) THEN
          CREATE USER ${user} WITH PASSWORD '${password}';
        ELSE
          ALTER USER ${user} WITH PASSWORD '${password}';
        END IF;
      END
      $$;

      GRANT USAGE ON SCHEMA ${schema} TO ${user};
      ALTER ROLE ${user} SET search_path = ${schema};
      GRANT ALL PRIVILEGES ON SCHEMA ${schema} TO ${user};
      ${schemaGrantSql}

      ${publicGrantSql}

      ${extraSchemaSql}
    `

    await client.query(ddlSql)

    const ensureTenantsSql = `
      CREATE TABLE IF NOT EXISTS public.tenants (
        slug text PRIMARY KEY,
        schema_name text NOT NULL,
        db_user text NOT NULL,
        db_password text NOT NULL,
        type text NOT NULL,
        external_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Backfill missing columns for older installs
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'schema_name'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN schema_name text;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'db_user'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN db_user text;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'db_password'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN db_password text;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'type'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN type text DEFAULT 'prod';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'external_id'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN external_id text;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'created_at'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN created_at timestamptz DEFAULT now();
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE public.tenants ADD COLUMN updated_at timestamptz DEFAULT now();
        END IF;
      END;
      $$;
    `
    await client.query(ensureTenantsSql)

    const upsertTenantSql = `
      INSERT INTO public.tenants (slug, schema_name, db_user, db_password, type, external_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT (slug) DO UPDATE
      SET schema_name = EXCLUDED.schema_name,
          db_user = EXCLUDED.db_user,
          db_password = EXCLUDED.db_password,
          type = EXCLUDED.type,
          external_id = EXCLUDED.external_id,
          updated_at = now();
    `

    await client.query(upsertTenantSql, [
      slug,
      schema,
      user,
      password,
      tenantType,
      externalId || null
    ])

    console.log('✅ Tenant provisioning completed')
    console.log(`- slug:        ${slug}`)
    console.log(`- schema:      ${schema}`)
    console.log(`- db user:     ${user}`)
    console.log(`- tenant type: ${tenantType}`)
    console.log('--------------------------------------------------')

    const parsedUrl = new URL(systemUrl)
    const host = parsedUrl.hostname
    const port = parsedUrl.port || '5433'
    const runtimeDbUrl = `postgresql://${user}:${password}@${host}:${port}/postgres?schema=${schema}`

    const envProductionPath = path.join(process.cwd(), '.env.production')
    const productionUpdates = {
      APP_SLUG: slug,
      NODE_ENV: 'production',
      DATABASE_URL: runtimeDbUrl,
      SYSTEM_DATABASE_URL: systemUrl,
      TENANT_DB_PASSWORD: password
    }
    persistEnv(envProductionPath, productionUpdates)

    if (!isProd) {
      const updates = {
        APP_SLUG: slug,
        NODE_ENV: 'development',
        DATABASE_URL: runtimeDbUrl,
        TENANT_DB_PASSWORD: password
      }

      if (!loadEnvFile(envPath).SYSTEM_DATABASE_URL) {
        updates.SYSTEM_DATABASE_URL = systemUrl
      }

      persistEnv(envPath, updates)
      console.log('✅ Updated .env for development')
      console.log('   DATABASE_URL=', runtimeDbUrl)
      console.log('--------------------------------------------------')
    } else {
      console.log('✅ Updated .env.production for production reference')
      console.log('🔑 DATABASE_URL (production):')
      console.log(runtimeDbUrl)
      console.log('--------------------------------------------------')
    }
  } catch (err) {
    console.error('❌ Error provisioning tenant:', err)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
