export const dynamic = 'force-dynamic'

const REGISTRATION_DISABLED_MESSAGE =
  'Public free registration is unavailable. Start JPV Bootcamp Membership Checkout or use an approved personal voucher or pay-it-forward code.'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(): Promise<Response> {
  return json(
    {
      ok: false,
      error: 'registration_disabled',
      message: REGISTRATION_DISABLED_MESSAGE,
      checkoutPath: '/upgrade',
    },
    410,
  )
}
