import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
	return NextResponse.json(
		{
			ok: true,
			status: 'live',
			timestamp: new Date().toISOString(),
			imageTag: process.env.IMAGE_TAG ?? null,
			commit:
				process.env.COMMIT_SHA ??
				process.env.VERCEL_GIT_COMMIT_SHA ??
				process.env.APP_BUILD_ID ??
				null,
			deploymentEnv: process.env.DEPLOYMENT_ENV ?? null,
		},
		{ status: 200 },
	)
}
