// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '**/*.min.js'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      prettierConfig,
    ],
    rules: {
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    },
  },
);
