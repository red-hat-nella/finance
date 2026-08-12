import eslint from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['.angular/**', 'dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'src/app/core/api/generated/**'] },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', URL: 'readonly' },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  ...angular.configs.tsRecommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'terms', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'terms', style: 'kebab-case' }],
      '@angular-eslint/prefer-inject': 'off',
    },
  },
  ...angular.configs.templateRecommended.map((config) => ({ ...config, files: ['**/*.html'] })),
  ...angular.configs.templateAccessibility.map((config) => ({ ...config, files: ['**/*.html'] })),
];
