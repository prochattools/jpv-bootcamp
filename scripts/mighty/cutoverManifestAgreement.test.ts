import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const manifest = readFileSync('docs/migration/MIGHTY_FINAL_PRE_CUTOVER_MANIFEST_2026-09-11.md', 'utf8')

const expectedActions: Record<string, string> = {
	'adaumoudit@gmail.com': 'IDENTITY_REVIEW_REQUIRED',
	'amechiclarangozi2022@gmail.com': 'IDENTITY_REVIEW_REQUIRED',
	'anita13steve@gmail.com': 'CREATE_NEW_AT_CUTOVER',
	'happyalamss@gmail.com': 'IDENTITY_REVIEW_REQUIRED',
	'info@yeshua.academy': 'PRIVILEGED_EXCLUDED',
	'Katherinecd7@yahoo.com': 'IDENTITY_REVIEW_REQUIRED',
	'kem.okupa@gmail.com': 'CREATE_NEW_AT_CUTOVER',
	'marek_bed@yahoo.com': 'CREATE_NEW_AT_CUTOVER',
	'missaquadri@gmail.com': 'IDENTITY_REVIEW_REQUIRED',
	'nsgonza2@gmail.com': 'CREATE_NEW_AT_CUTOVER',
	'prince.okoroego@gmail.com': 'CREATE_NEW_AT_CUTOVER',
	'ronyaa@live.co.uk': 'IDENTITY_REVIEW_REQUIRED',
	'samuel.roy.edward.hill@gmail.com': 'IDENTITY_REVIEW_REQUIRED',
	'steve@yeshua.academy': 'PRIVILEGED_EXCLUDED',
	'tosinotubanjo@gmail.com': 'OVERLAP_REVIEW_REQUIRED',
	'vimbaimt@gmail.com': 'CREATE_NEW_AT_CUTOVER',
	'westhoek@hotmail.com': 'ALREADY_PLAN_CONTROLLED',
}

test('human manifest contains exactly the application rehearsal identities and actions', () => {
	assert.equal(Object.keys(expectedActions).length, 17)
	for (const [email, action] of Object.entries(expectedActions)) {
		assert.ok(manifest.includes('| `' + email + '` |'), 'missing manifest identity: ' + email)
		assert.match(manifest, new RegExp('\\| `' + email + '` \\|[\\s\\S]*?\\| `' + action + '`'))
	}
	for (const action of Object.values(expectedActions)) assert.match(manifest, new RegExp('`' + action + '`'))
	assert.match(manifest, /application output and this table agree on all 17 normalized identities/)
})
