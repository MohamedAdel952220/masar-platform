/** Root ESLint config — applies to every package and app. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
    // The api-client package is the ONLY place allowed to import supabase-js
    // directly (FRONTEND_ARCHITECTURE.md §2). Enforced per-app below.
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@supabase/supabase-js',
        message: 'Import backend access through @masar/api-client instead (FRONTEND_ARCHITECTURE.md §2).',
      }],
    }],
  },
  overrides: [
    {
      // The api-client package is the sanctioned exception.
      files: ['packages/api-client/**/*.ts', 'packages/api-client/**/*.tsx', 'packages/auth/**/*.ts', 'packages/auth/**/*.tsx'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // Context providers intentionally export the provider component and its
      // consumer hook from one file — that co-location is the documented React
      // pattern, and the react-refresh rule is an HMR ergonomics hint rather
      // than a correctness concern.
      files: ['**/providers/*.tsx', '**/*Provider.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
