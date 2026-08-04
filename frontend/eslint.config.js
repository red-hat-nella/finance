import eslint from '@eslint/js';
import angular from 'angular-eslint';

export default [
  { ignores: ['.angular/**', 'dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'src/app/core/api/generated/**'] },
  eslint.configs.recommended,
  ...angular.configs.tsRecommended,
  {
    files: ['**/*.ts'],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  ...angular.configs.templateRecommended,
  ...angular.configs.templateAccessibility,
];
