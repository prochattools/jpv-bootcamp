#!/usr/bin/env node

process.stderr.write(
  'LEGACY_BUNNY_NUMERIC_ID_RESOLUTION_DEPRECATED Bunny Stream uses the video GUID as its canonical video identifier. Use scripts/migration/verifyLegacyBunnyVideos.ts for GET-only GUID verification.\n',
)
process.exitCode = 1
