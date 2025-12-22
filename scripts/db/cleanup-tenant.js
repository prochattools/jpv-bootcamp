// ProKit – ProChat SaaS Starter
// (c) 2025 Steve Westhoek / ProChat
// scripts/db/cleanup-tenant.js
// Deletes a tenant schema + user + registry row.
//
// Usage:
//   node scripts/db/cleanup-tenant.js --slug pr_42
//   node scripts/db/cleanup-tenant.js --slug myapp --force   # dangerous

const { Client } = require('pg')

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { slug: process.env.APP_SLUG || '', force: false }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--slug' && args[i + 1]) {
      result.slug = args[++i]
    } else if (a === '--force') {
      result.force = true
    }
  }

  if (!result.slug) {
    console.error('❌ Missing tenant slug. Set APP_SLUG or pass --slug <slug>.')
    process.exit(1)
  }

  if (!/^[a-z0-9_]+$/.test(result.slug)) {
    console.error(
      `❌ Invalid slug "${result.slug}". Only lowercase letters, numbers and underscores are allowed.`
    )
    process.exit(1)
  }

  return result
}

async function main() {
  const { slug, force } = parseArgs()
  const systemUrl = process.env.SYSTEM_DATABASE_URL

  if (!systemUrl) {
    console.error('❌ SYSTEM_DATABASE_URL is not set.')
    process.exit(1)
  }

  const client = new Client({ connectionString: systemUrl })

  console.log('--------------------------------------------------')
  console.log(`🧹 Cleaning up tenant "${slug}" (force=${force})`)
  console.log('--------------------------------------------------')

  try {
    await client.connect()

    const { rows } = await client.query(
      `SELECT slug, schema_name, db_user, type FROM public.tenants WHERE slug = $1`,
      [slug]
    )

    if (rows.length === 0) {
      console.log('ℹ️ No tenant row found; nothing to clean up.')
      return
    }

    const tenant = rows[0]

    if (tenant.type !== 'preview' && !force) {
      console.error(
        `❌ Refusing to drop non-preview tenant "${slug}" (type=${tenant.type}). Use --force to override.`
      )
      process.exit(1)
    }

    const schemaName = tenant.schema_name || `tenant_${slug}`
    const dbUser = tenant.db_user || `tenant_${slug}_user`

    console.log(`Schema: ${schemaName}`)
    console.log(`User:   ${dbUser}`)

    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`)

    await client.query(
      `
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_catalog.pg_roles WHERE rolname = $1
  ) THEN
    EXECUTE format('DROP ROLE %I', $1);
  END IF;
END
$$;
`,
      [dbUser]
    )

    await client.query(`DELETE FROM public.tenants WHERE slug = $1`, [slug])

    console.log('✅ Tenant cleanup completed.')
  } catch (err) {
    console.error('❌ Error cleaning up tenant:', err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
