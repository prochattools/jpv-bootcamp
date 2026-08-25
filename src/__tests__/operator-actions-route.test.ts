import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockPayload = {
  auth: vi.fn(),
  findByID: vi.fn(),
  create: vi.fn(),
}

vi.mock('payload', () => ({
  getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))

vi.mock('@/lib/auth/payloadSession', () => ({
  resolvePayloadRequestSession: vi.fn(),
}))

import { POST } from '@/app/api/admin/operator-actions/route'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

const mockedResolveSession = vi.mocked(resolvePayloadRequestSession)

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/operator-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: 'payload-token=test' },
    body: JSON.stringify(body),
  })
}

function adminSession(id: string | number = 'admin-1') {
  return {
    administratorId: id,
    member: null,
    unresolvedCollection: false,
    authenticatedCollection: 'payload_users',
  }
}

function memberSession() {
  return {
    administratorId: null,
    member: { id: 'member-1', accountStatus: 'active', emailVerifiedAt: '2024-01-01' },
    unresolvedCollection: false,
    authenticatedCollection: 'payload_members',
  }
}

function unauthenticatedSession() {
  return {
    administratorId: null,
    member: null,
    unresolvedCollection: false,
    authenticatedCollection: null,
  }
}

describe('POST /api/admin/operator-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('rejects unauthenticated requests with 403', async () => {
      mockedResolveSession.mockResolvedValue(unauthenticatedSession())
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '123' }))
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe('unauthorized')
    })

    it('rejects member-authenticated requests with 403', async () => {
      mockedResolveSession.mockResolvedValue(memberSession())
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '123' }))
      expect(res.status).toBe(403)
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      mockedResolveSession.mockResolvedValue(adminSession())
    })

    it('rejects missing collection with 400', async () => {
      const res = await POST(makeRequest({ actionType: 'sync_subscription', subscription: '123' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('unsupported_collection')
    })

    it('rejects unsupported collection with 400', async () => {
      const res = await POST(makeRequest({ collection: 'payload_users', actionType: 'sync_subscription', subscription: '123' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('unsupported_collection')
    })

    it('rejects unsupported billing action type', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'delete_everything', subscription: '123' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('unsupported_action')
    })

    it('rejects unsupported email action type', async () => {
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'send_spam', emailEvent: '26' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('unsupported_action')
    })

    it('rejects missing subscription ID for billing actions', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })

    it('rejects missing emailEvent ID for email actions', async () => {
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })

    it('rejects Stripe subscription ID (provider ID) for billing actions', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: 'sub_1234567890' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })

    it('rejects Stripe customer ID for billing actions', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: 'cus_abc123' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })

    it('rejects empty string subscription ID', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })

    it('rejects empty string emailEvent ID', async () => {
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery', emailEvent: '' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_input')
    })
  })

  describe('record resolution', () => {
    beforeEach(() => {
      mockedResolveSession.mockResolvedValue(adminSession())
    })

    it('returns 404 when subscription record does not exist', async () => {
      mockPayload.findByID.mockRejectedValue(new Error('not found'))
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '999' }))
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe('record_not_found')
    })

    it('returns 404 when email event record does not exist', async () => {
      mockPayload.findByID.mockRejectedValue(new Error('not found'))
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery', emailEvent: '999' }))
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe('record_not_found')
    })

    it('returns 400 when email event is not in failed state', async () => {
      mockPayload.findByID.mockResolvedValue({ id: '26', deliveryStatus: 'queued' })
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery', emailEvent: '26' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('invalid_state')
    })
  })

  describe('successful billing action creation', () => {
    beforeEach(() => {
      mockedResolveSession.mockResolvedValue(adminSession())
      mockPayload.findByID.mockResolvedValue({ id: '42', stripeSubscriptionId: 'sub_test_xyz' })
      mockPayload.create.mockResolvedValue({ id: 'action-1', status: 'pending', actionType: 'sync_subscription' })
    })

    it('creates billing action with 201 response', async () => {
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '42' }))
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json).toEqual({ id: 'action-1', status: 'pending', actionType: 'sync_subscription' })
    })

    it('passes resolved subscription record ID to payload.create', async () => {
      await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'cancel_at_period_end', subscription: '42', note: 'Test cancel' }))
      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'payload_billing_actions',
          data: expect.objectContaining({
            actionType: 'cancel_at_period_end',
            subscription: '42',
            requestedBy: 'admin-1',
            status: 'pending',
            notes: 'Test cancel',
          }),
          overrideAccess: true,
          user: { id: 'admin-1', collection: 'payload_users' },
        }),
      )
    })

    it('resolves subscription record via findByID before create', async () => {
      await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '42' }))
      expect(mockPayload.findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'payload_subscriptions',
          id: '42',
          overrideAccess: true,
        }),
      )
    })

    it('returns only public fields, not full doc', async () => {
      mockPayload.create.mockResolvedValue({
        id: 'action-1',
        status: 'pending',
        actionType: 'sync_subscription',
        internalField: 'should-not-appear',
        requestedBy: 'admin-1',
      })
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '42' }))
      const json = await res.json()
      expect(json).not.toHaveProperty('internalField')
      expect(json).not.toHaveProperty('requestedBy')
      expect(Object.keys(json)).toEqual(['id', 'status', 'actionType'])
    })
  })

  describe('successful email action creation', () => {
    beforeEach(() => {
      mockedResolveSession.mockResolvedValue(adminSession())
      mockPayload.findByID.mockResolvedValue({ id: '26', deliveryStatus: 'failed' })
      mockPayload.create.mockResolvedValue({ id: 'action-2', status: 'pending', actionType: 'retry_delivery' })
    })

    it('creates email action with 201 response', async () => {
      const res = await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery', emailEvent: '26' }))
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json).toEqual({ id: 'action-2', status: 'pending', actionType: 'retry_delivery' })
    })

    it('resolves email event record via findByID before create', async () => {
      await POST(makeRequest({ collection: 'payload_email_actions', actionType: 'retry_delivery', emailEvent: '26' }))
      expect(mockPayload.findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'payload_email_events',
          id: '26',
          overrideAccess: true,
        }),
      )
    })
  })

  describe('error redaction', () => {
    beforeEach(() => {
      mockedResolveSession.mockResolvedValue(adminSession())
      mockPayload.findByID.mockResolvedValue({ id: '42', stripeSubscriptionId: 'sub_test_xyz' })
    })

    it('does not expose internal error messages in 500 response', async () => {
      mockPayload.create.mockRejectedValue(new Error('Database connection lost: host=db.internal.example.com'))
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '42' }))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toBe('internal_error')
      expect(json.message).toBe('The request could not be completed.')
      expect(JSON.stringify(json)).not.toContain('Database connection lost')
      expect(JSON.stringify(json)).not.toContain('db.internal')
    })

    it('does not expose stack traces', async () => {
      const err = new Error('Unexpected failure')
      err.stack = 'Error: Unexpected failure\n    at /app/src/lib/secret.ts:42'
      mockPayload.create.mockRejectedValue(err)
      const res = await POST(makeRequest({ collection: 'payload_billing_actions', actionType: 'sync_subscription', subscription: '42' }))
      const json = await res.json()
      expect(JSON.stringify(json)).not.toContain('stack')
      expect(JSON.stringify(json)).not.toContain('secret.ts')
    })
  })
})
