import { readFileSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = process.cwd()

async function validateCopyApprovalPacket() {
	const packetPath = join(REPO_ROOT, 'docs/client/FRONTEND_COPY_APPROVAL_PACKET.md')
	const checklistPath = join(REPO_ROOT, 'docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md')
	const readmePath = join(REPO_ROOT, 'docs/client/README.md')
	const roadmapPath = join(REPO_ROOT, 'docs/client/ROADMAP_PROGRESS_STATUS.md')

	const packetContent = readFileSync(packetPath, 'utf-8')
	const checklistContent = readFileSync(checklistPath, 'utf-8')
	const readmeContent = readFileSync(readmePath, 'utf-8')
	const roadmapContent = readFileSync(roadmapPath, 'utf-8')

	const tests: Array<{ name: string; pass: boolean; error?: string }> = []

	// Required packet structure
	const requiredStrings = [
		{ text: 'Version 3.4', desc: 'Version number' },
		{ text: 'feature/course-branding-and-preview', desc: 'Branch name' },
		{ text: '15 July 2026', desc: 'Client content due date' },
		{ text: '22 July 2026', desc: 'Front-end go-live milestone' },
		{ text: '23 July 2026', desc: 'Handover buffer date' },
		{ text: '24 July 2026', desc: 'Client finished-by date' },
		{ text: '£80', desc: 'Monthly pricing' },
		{ text: '£800', desc: 'Annual pricing' },
		{ text: 'support/pay-it-forward', desc: 'Pay-it-forward terminology' },
		{ text: 'Voucher and pay-it-forward use the same membership access', desc: 'Voucher and pay-it-forward access description' },
		{ text: 'Migrations applied: No', desc: 'Migrations not applied' },
		{ text: 'does not authorize migration execution', desc: 'Migration authorization statement' },
	]

	for (const req of requiredStrings) {
		const found = packetContent.includes(req.text)
		tests.push({
			name: `Packet includes "${req.desc}"`,
			pass: found,
			error: found ? undefined : `Missing: ${req.text}`,
		})
	}

	// Required table headers
	const tableHeaders = [
		'Area',
		'Current source/location',
		'Current wording or placeholder summary',
		'Client action needed',
		'Approve as-is?',
		'Replacement copy / notes',
	]

	for (const header of tableHeaders) {
		const found = packetContent.includes(header)
		tests.push({
			name: `Packet table includes "${header}" column`,
			pass: found,
			error: found ? undefined : `Missing column: ${header}`,
		})
	}

	// Verify checklist links to packet
	const checklistLinksToPacket = checklistContent.includes('FRONTEND_COPY_APPROVAL_PACKET')
	tests.push({
		name: 'FRONTEND_CONTENT_INTAKE_CHECKLIST references copy approval packet',
		pass: checklistLinksToPacket,
		error: checklistLinksToPacket ? undefined : 'Checklist does not link to FRONTEND_COPY_APPROVAL_PACKET',
	})

	// Verify README links to packet
	const readmeLinksToPacket = readmeContent.includes('FRONTEND_COPY_APPROVAL_PACKET')
	tests.push({
		name: 'README.md references copy approval packet',
		pass: readmeLinksToPacket,
		error: readmeLinksToPacket ? undefined : 'README does not link to FRONTEND_COPY_APPROVAL_PACKET',
	})

	// Verify roadmap mentions packet or copy approval dependency
	const roadmapMentionsCopy = roadmapContent.includes('FRONTEND_COPY_APPROVAL') || roadmapContent.includes('copy')
	tests.push({
		name: 'ROADMAP_PROGRESS_STATUS mentions copy approval or front-end copy',
		pass: roadmapMentionsCopy,
		error: roadmapMentionsCopy ? undefined : 'Roadmap does not mention copy approval',
	})

	// Verify no dangerous patterns
	const dangerousPatterns = [
		{ pattern: /prisma\s+migrate/i, desc: 'prisma migrate command' },
		{ pattern: /payload\s+migrate/i, desc: 'payload migrate command' },
		{ pattern: /db\s+push/i, desc: 'db push command' },
		{ pattern: /fetch\(/i, desc: 'network fetch' },
		{ pattern: /axios\./i, desc: 'axios HTTP calls' },
		{ pattern: /http\.request/i, desc: 'http.request network call' },
		{ pattern: /https\.request/i, desc: 'https.request network call' },
		{ pattern: /DATABASE_URL/i, desc: 'DATABASE_URL environment variable' },
	]

	for (const { pattern, desc } of dangerousPatterns) {
		const found = pattern.test(packetContent)
		tests.push({
			name: `Packet does not contain ${desc}`,
			pass: !found,
			error: found ? `Found forbidden pattern: ${desc}` : undefined,
		})
	}

	// Report results
	let passed = 0
	let failed = 0

	console.log('\n=== Frontend Copy Approval Static Test ===\n')

	for (const test of tests) {
		if (test.pass) {
			console.log(`✓ ${test.name}`)
			passed++
		} else {
			console.log(`✗ ${test.name}`)
			if (test.error) console.log(`  ${test.error}`)
			failed++
		}
	}

	console.log(`\nResults: ${passed} pass, ${failed} fail\n`)

	if (failed > 0) {
		process.exit(1)
	}
}

validateCopyApprovalPacket().catch((err) => {
	console.error('Test error:', err.message)
	process.exit(1)
})
