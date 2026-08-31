export const dynamic = 'force-dynamic'

export async function POST(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: 'email_change_disabled',
      message: 'Member email changes are disabled. Please contact support.',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
