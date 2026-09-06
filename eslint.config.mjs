import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      'no-extra-boolean-cast': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'prefer-const': 'off',
      'react/prop-types': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,cjs,ts}', 'e2e/**/*.ts', '*.{config.js,config.cjs,config.ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
