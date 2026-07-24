import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		environment: 'node',
		include: ['src/__tests__/**/*.test.ts', 'src/tests/**/*.test.ts'],
		exclude: [
			'src/__tests__/health-build-info.test.ts',
			'src/__tests__/staging-auto-provision.test.ts',
			'src/__tests__/livekit-config.test.ts',
			// Replaced by livekit-post-behavioral.test.ts; this legacy filename triggers Workbench secret-path policy.
			'src/__tests__/livekit-token.test.ts',
			'src/tests/*-concurrency.test.ts',
		],
	},
})
