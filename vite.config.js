// Builds the plugin UI (ui/) into a single self-contained dist/ui.html, as
// Figma requires: every script and stylesheet is inlined, nothing is fetched.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'ui',
  base: './',
  plugins: [
    viteSingleFile(),
    {
      name: 'autoflow-ui-filename',
      enforce: 'post',
      generateBundle(_, bundle) {
        const html = bundle['index.html'];
        if (html) html.fileName = 'ui.html';
      },
    },
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: false, // dist/code.js is written by scripts/build.mjs
    target: 'es2020',
    // FigUI3 ships a `&::not(...)` typo that lightningcss reports; esbuild minifies it as-is.
    cssMinify: 'esbuild',
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
  },
});
