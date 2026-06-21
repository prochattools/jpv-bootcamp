'use server'
import { handleServerFunctions } from '@payloadcms/next/layouts'
import config from '@payload-config'
import { importMap } from './importMap.js'

export async function serverFunction(args: Parameters<typeof handleServerFunctions>[0]) {
  return handleServerFunctions({ ...args, config, importMap })
}
