// Builds the plugin UI (ui/, React + FigUI) into a single self-contained
// dist/ui.html, as Figma requires: the CSS (Tailwind) and the JS (esbuild)
// are inlined, nothing is fetched. The sandbox code is built by scripts/build.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const ui = join(root, 'ui');
mkdirSync(join(root, 'dist'), { recursive: true });

// CSS: FigUI tokens + Tailwind utilities used in ui/.
const cssFile = join(root, 'dist', '.ui.css');
execFileSync(join(root, 'node_modules', '.bin', 'tailwindcss'), ['-i', join(ui, 'styles', 'app.css'), '-o', cssFile, '--minify'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'pipe'],
});
const css = readFileSync(cssFile, 'utf8');
rmSync(cssFile);
if (/<\/style/i.test(css)) throw new Error('The generated CSS contains </style>');

// JS: one IIFE with React, Base UI and the FigUI components.
const result = await esbuild.build({
  entryPoints: [join(ui, 'main.tsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  alias: { '@': ui },
  loader: { '.html': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none', // the notices are collected below, in the HTML header
  metafile: true,
  logLevel: 'error',
});
// Inline <script>: never close it or open an HTML comment from inside.
const js = result.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
new Function(js); // syntax check of the escaped bundle

// Third-party packages actually bundled, with their license (from package.json).
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const m = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (!m || packages.has(m[1])) continue;
  const pkg = JSON.parse(readFileSync(join(root, 'node_modules', m[1], 'package.json'), 'utf8'));
  const license = /^\(.*\)$/.test(pkg.license) ? pkg.license : `(${pkg.license})`;
  packages.set(m[1], `${pkg.name} ${pkg.version} ${license}`);
}
const bundled = [...packages.values()].sort().map((line) => `    ${line}`).join('\n');
const mit = readFileSync(join(ui, 'components', 'ui', 'LICENSE'), 'utf8')
  .split('\n')
  .slice(4) // the permission notice, without the title and copyright lines
  .join('\n')
  .trim()
  .replace(/^/gm, '  ');

const html = `<!doctype html>
<!--
  Third-party software bundled in this UI

  FigUI (https://figui.dev, https://github.com/anxndsgn/figui): MIT License,
    Copyright (c) 2026 XIN. Components copied unchanged into ui/components/ui,
    plus ui/lib/utils.ts and the tokens in ui/styles/figui.css.

  UI3 icons from @create-figma-plugin/ui: MIT License,
    Copyright (c) Yuan Qing Lim.

  npm packages in the bundle (name, version, license):
${bundled}
    tailwindcss ${JSON.parse(readFileSync(join(root, 'node_modules', 'tailwindcss', 'package.json'), 'utf8')).version} (MIT): the generated CSS

  MIT License text (applies to FigUI, the UI3 icons and the MIT packages):

${mit}

  Full notices and the other license texts: THIRD_PARTY_NOTICES.md.
-->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Autoflow</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
const out = join(root, 'dist', 'ui.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`dist/ui.html  ${Math.round(Buffer.byteLength(html) / 1024)} KB (FigUI)`);
