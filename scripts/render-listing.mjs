// Renders the Figma Community images (publish/icon.png, cover.png, carousel-*.png) with headless Chrome.
// The slides embed the real panel through test/ui/harness.html, so run `npm run build` first
// (`npm run listing` does). Pages are served over a local HTTP server so the harness can drive the UI.
// Usage: node scripts/render-listing.mjs [name…]   (e.g. `cover carousel-2-attached`; default: all)
// Set CHROME to the browser binary if it is not in the default macOS location.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const SLIDES = [
  'cover',
  'carousel-1-how-it-works',
  'carousel-2-attached',
  'carousel-3-flows',
  'carousel-4-styles',
  'carousel-5-prototype',
  'carousel-6-native',
  'carousel-7-closing',
];
const only = process.argv.slice(2);
const PAGES = (only.length ? only.filter((name) => name !== 'icon') : SLIDES)
  .map((name) => [`publish/src/${name}.html`, `publish/${name}.png`, [1920, 1080]]);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function connect(profile) {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !(existsSync(portFile) && readFileSync(portFile, 'utf8').includes('\n')); i++) await sleep(100);
  const [port, path] = readFileSync(portFile, 'utf8').split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((listener) => listener(msg));
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const once = (method, sessionId) => new Promise((resolve) => {
    const listener = (msg) => {
      if (msg.method === method && msg.sessionId === sessionId) {
        listeners.splice(listeners.indexOf(listener), 1);
        resolve(msg.params);
      }
    };
    listeners.push(listener);
  });
  return { ws, send, once };
}

async function screenshot({ send, once }, url, out, [width, height]) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.enable', {}, sessionId);
  const loaded = once('Page.loadEventFired', sessionId);
  await send('Page.navigate', { url }, sessionId);
  await loaded;
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true }, sessionId);
  // Slides with an embedded panel set window.listingReady once the harness has sized it.
  await send('Runtime.evaluate', {
    expression: `new Promise((r) => { const t = Date.now(); (function w() {
      if (window.listingReady !== false || Date.now() - t > 8000) r(true); else setTimeout(w, 100); })(); })`,
    awaitPromise: true,
  }, sessionId);
  await sleep(400);
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(out, Buffer.from(data, 'base64'));
  await send('Target.closeTarget', { targetId });
  console.log(`${out.replace(root, '')} (${width}×${height})`);
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const work = mkdtempSync(join(tmpdir(), 'listing-'));
const browser = spawn(chrome, [
  '--headless', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'
], { stdio: 'ignore' });

try {
  const cdp = await connect(join(work, 'profile'));
  if (!only.length || only.includes('icon')) {
    writeFileSync(join(root, 'publish/.icon.html'), `<!doctype html><style>html,body{margin:0}img{display:block}</style>
<img src="icon.svg" width="128" height="128">`);
    await screenshot(cdp, `${base}publish/.icon.html`, join(root, 'publish/icon.png'), [128, 128]);
    rmSync(join(root, 'publish/.icon.html'));
  }
  for (const [page, out, size] of PAGES) {
    await screenshot(cdp, base + page, join(root, out), size);
  }
  cdp.ws.close();
} finally {
  browser.kill();
  server.close();
  await sleep(300);
  rmSync(work, { recursive: true, force: true });
}
