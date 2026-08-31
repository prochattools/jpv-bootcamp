import assert from 'node:assert/strict'

import {
  getPayloadAdministratorRecipients,
  parseConfiguredEmailRecipients,
} from '../src/lib/payloadCourse/adminRecipients'

assert.deepEqual(
  parseConfiguredEmailRecipients([
    ' Admin@One.Example, ops@example.com ',
    'admin@one.example,invalid-address',
  ]),
  ['admin@one.example', 'ops@example.com'],
)

const payload = {
  async find(args: { collection: string }) {
    assert.equal(args.collection, 'payload_users')
    return {
      docs: [
        { id: 'admin-1', email: 'Admin@One.Example' },
        { id: 'admin-2', email: 'ops@example.com' },
        { id: 'admin-duplicate', email: 'ADMIN@ONE.EXAMPLE' },
        { id: 'admin-invalid', email: 'not-an-email' },
      ],
    }
  },
} as never

async function main(): Promise<void> {
  const recipients = await getPayloadAdministratorRecipients(payload, [
    ' Admin@One.Example, finance@example.com ',
    'ops@example.com',
  ])

  assert.deepEqual(
    recipients.map((recipient) => recipient.email),
    ['admin@one.example', 'finance@example.com', 'ops@example.com'],
  )
  assert.equal(recipients.filter((recipient) => recipient.email === 'admin@one.example').length, 1)

  console.log('payload administrator recipient resolution tests passed')
}

void main()
