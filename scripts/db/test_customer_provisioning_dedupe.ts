import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const SHOULD_INSERT = process.env.ALLOW_PROVISIONING_DEDUPE_TEST === '1'
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
	console.error('DATABASE_URL is required to run the dedupe test.')
	process.exit(1)
}

const SQL_PATH = path.resolve(
	process.cwd(),
	'docs/sql/003_dedupe_customer_provisioning.sql'
)

const NORMALIZED_EMAIL = 'dedupe-test@example.com'

async function run(): Promise<void> {
	const client = new Client({ connectionString: DATABASE_URL })
	await client.connect()

	const { rows: indexRows } = await client.query(
		`select indexname
		 from pg_indexes
		 where schemaname = 'tenant_jpvbootcamp'
		   and tablename = 'customer_provisioning'
		   and indexname = 'customer_provisioning_normalized_email_key'`
	)
	const hasUniqueIndex = indexRows.length > 0

	if (!fs.existsSync(SQL_PATH)) {
		console.error('SQL migration file missing:', SQL_PATH)
		process.exit(1)
	}

	const sql = fs.readFileSync(SQL_PATH, 'utf8')

	if (SHOULD_INSERT && hasUniqueIndex) {
		console.warn(
			'Normalized email unique index already exists; skipping duplicate inserts.'
		)
	}

	if (SHOULD_INSERT) {
		await client.query('BEGIN')
		try {
			await client.query(
				`delete from tenant_jpvbootcamp.customer_provisioning
				 where normalized_email = $1`,
				[NORMALIZED_EMAIL]
			)

			if (!hasUniqueIndex) {
				await client.query(
					`insert into tenant_jpvbootcamp.customer_provisioning
						(email, normalized_email, stripe_customer_id, status, created_at, updated_at)
					 values
						($1, $1, 'cus_test_dedupe_1', 'active', now(), now()),
						($2, $1, 'cus_test_dedupe_2', 'active', now() - interval '1 day', now() - interval '1 day')`,
					['Dedupe-Test@example.com', 'dedupe-test@example.com']
				)
			}

			await client.query(sql)

			const { rows } = await client.query(
				`select count(*)::int as count
				 from tenant_jpvbootcamp.customer_provisioning
				 where normalized_email = $1`,
				[NORMALIZED_EMAIL]
			)

			console.log('dedupe_test_count', {
				normalizedEmail: NORMALIZED_EMAIL,
				count: rows[0]?.count ?? 0,
			})
		} finally {
			await client.query('ROLLBACK')
		}
	} else {
		const { rows } = await client.query(
			`select normalized_email, count(*)::int as count
			 from tenant_jpvbootcamp.customer_provisioning
			 group by normalized_email
			 having count(*) > 1
			 order by count desc
			 limit 5`
		)
		console.log('customer_provisioning_duplicates', rows)
	}

	await client.end()
}

run().catch((error) => {
	console.error('Dedupe test failed:', {
		message: (error as Error).message ?? 'unknown_error',
	})
	process.exit(1)
})
