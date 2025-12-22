#!/usr/bin/env node
// ProKit – ProChat SaaS Starter
// (c) 2025 Steve Westhoek / ProChat

const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env')

if (fs.existsSync(envPath)) {
  console.log('✅ .env already exists, skipping bootstrap')
  process.exit(0)
}

// Default dev slug + system connection
const rawSlug = process.env.APP_SLUG || 'dev'
const slug = rawSlug.trim() || 'dev'

const systemUrl =
  process.env.SYSTEM_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'

const content = [
  `APP_SLUG=${slug}`,
  `NODE_ENV=development`,
  `SYSTEM_DATABASE_URL=${systemUrl}`,
  `# DATABASE_URL will be populated automatically after the first "npm run db:init"`,
  ''
].join('\n')

fs.writeFileSync(envPath, content, { encoding: 'utf8' })
console.log('✅ Created .env for development with default settings')
