import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import globals from 'globals'

export default defineConfig([
  js.configs.recommended,
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // `module` is a first-class course-domain term throughout the TypeScript codebase.
      // Next's rule only checks the identifier name, so it reports these domain variables
      // even though they are unrelated to the CommonJS `module` global.
      '@next/next/no-assign-module-variable': 'off',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
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
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
