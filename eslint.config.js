import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Components and hooks must go through the repository hooks, never the mock layer.
  // Only src/data/index.ts (the single DI point) and tests may import data/mock.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/index.ts', 'src/data/mock/**', 'src/test/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/mock', '**/data/mock/*', '**/mock/*', './mock', './mock/*'],
              message:
                'Do not import the mock data layer directly. Use the query hooks; src/data/index.ts is the only DI point.',
            },
          ],
        },
      ],
    },
  },
)
