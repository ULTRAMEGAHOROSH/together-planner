// @ts-check
// Project rules: docs/frontend-development-guide.md §4–§6, decisions FD-03, FD-10…13, FD-30.
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// --- Time rules (FD-30…33): local date-times are strings / local minutes, never Date. ---
const noLocalDate = [
  'error',
  {
    selector: "NewExpression[callee.name='Date'][arguments.length>0]",
    message:
      'Do not build Date from values: local date-times live in shared/time (parseLocalDateTime, toLocalMinutes). "Now" comes from ZoneClock.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='parse']",
    message: 'Date.parse is forbidden: use shared/time helpers.',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(get|set)(Hours|Minutes|Seconds|Milliseconds|Date|Day|Month|FullYear)$/]',
    message: 'Local Date getters/setters depend on the browser time zone: use shared/time helpers.',
  },
];

// --- Layer boundaries (FD-10…13). Paths are matched as written in the import. ---
const ban = (group, message) => ({ group, message });
const featureDeepImport = ban(
  ['@features/*/*', '**/features/*/*/**'],
  'Import another feature only through its public API: @features/<name> (index.ts).',
);
const layoutImport = ban(
  ['@layout/*', '**/layout/**'],
  'Features and shared code must not depend on layout.',
);
const featureImport = ban(
  ['@features/*', '**/features/**'],
  'This layer must not depend on features.',
);

const coreRules = [
  featureImport,
  layoutImport,
  ban(
    ['@shared/*', '!@shared/time', '!@shared/time/*', '!@shared/domain', '!@shared/domain/*'],
    'core may use only shared/time and shared/domain from shared.',
  ),
  ban(
    ['**/shared/ui/**', '**/shared/timeline/**', '**/shared/forms/**'],
    'core may use only shared/time and shared/domain.',
  ),
];
const sharedRules = [
  featureImport,
  layoutImport,
  ban(
    ['@core/auth/*', '**/core/auth/**'],
    'shared code must not depend on the session (core/auth).',
  ),
];
const engineRules = [
  ...sharedRules,
  ban(
    ['@angular/*', 'rxjs', 'rxjs/*'],
    'The timeline engine is plain TypeScript: no Angular, no RxJS.',
  ),
  ban(
    ['@core/*', '!@core/api', '!@core/api/models', '!@core/api/models/*'],
    'The timeline engine may use only API models from core.',
  ),
];
const restrict = (patterns) => ['error', { patterns }];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'tp', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'tp', style: 'kebab-case' },
      ],
      // Angular 22: OnPush is the default. Forbid opting out (Eager/Default) and redundant OnPush.
      '@angular-eslint/prefer-on-push-component-change-detection': [
        'error',
        { allowExplicitOnPush: false },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': noLocalDate,
    },
  },
  {
    // The only places allowed to touch Date directly.
    files: ['src/app/shared/time/**/*.ts', 'src/app/core/time/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  { files: ['src/app/core/**/*.ts'], rules: { 'no-restricted-imports': restrict(coreRules) } },
  { files: ['src/app/shared/**/*.ts'], rules: { 'no-restricted-imports': restrict(sharedRules) } },
  {
    files: ['src/app/shared/timeline/engine/**/*.ts'],
    rules: { 'no-restricted-imports': restrict(engineRules) },
  },
  {
    files: ['src/app/layout/**/*.ts'],
    rules: { 'no-restricted-imports': restrict([featureDeepImport]) },
  },
  {
    files: ['src/app/features/**/*.ts'],
    rules: { 'no-restricted-imports': restrict([featureDeepImport, layoutImport]) },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
