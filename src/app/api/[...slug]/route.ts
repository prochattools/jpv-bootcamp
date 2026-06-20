import { REST_DELETE, REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import config from '@payload-config'
import { importMap } from '../../(payload)/importMap.js'

export const GET = REST_GET(config, importMap)
export const POST = REST_POST(config, importMap)
export const DELETE = REST_DELETE(config, importMap)
export const PATCH = REST_PATCH(config, importMap)
