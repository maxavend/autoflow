import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'ui/icons.js'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, figma: 'readonly', __html__: 'readonly' } },
  },
  {
    files: ['ui/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Community listing pages: classic browser scripts shared through globals
    files: ['publish/src/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js', 'test/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
