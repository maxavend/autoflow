import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ui/components/ui: FigUI components copied unchanged (see its ORIGEN.md).
  // release/: shareable builds (git-ignored).
  { ignores: ['dist/', 'node_modules/', 'release/', 'ui/icons.js', 'ui/components/ui/'] },
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
    // Panel UI: React + FigUI (TypeScript)
    files: ['ui/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // Community listing pages: classic browser scripts shared through globals
    files: ['publish/src/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js', 'test/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
