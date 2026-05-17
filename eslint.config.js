import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

// Flat config (ESLint 9). Replaces the legacy .eslintrc.
// Lint surface and rule set are kept identical to the previous .eslintrc:
//   - eslint:recommended + @typescript-eslint recommended
//   - prettier integration (eslint-plugin-prettier + eslint-config-prettier)
//   - the three @typescript-eslint rules we intentionally relax
//   - dist/, docs/ and minified bundles excluded
export default tseslint.config(
  {
    ignores: ['dist/', 'docs/', '**/*.min.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Underscore-prefixed args/vars are an intentional "unused on purpose"
      // marker in this codebase (e.g. getInvalidRutError(_rut)).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Must stay last so it can turn off stylistic rules that conflict with Prettier.
  eslintPluginPrettierRecommended,
)
