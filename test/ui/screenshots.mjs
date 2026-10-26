// Headless Chrome screenshots of the built panel (via test/ui/harness.html).
// Needs the harness served at BASE (npm run preview server or python http.server).
// Usage: node test/ui/screenshots.mjs [base-url]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 'dark-connector', theme: 'dark', scenario: 'connector' },
  { name: 'light-connector', theme: 'light', scenario: 'connector' },
  { name: 'dark-nolabel', theme: 'dark', scenario: 'nolabel' },
  { name: 'light-defaults', theme: 'light', scenario: 'defaults' },
  { name: 'dark-nodes', theme: 'dark', scenario: 'nodes' },
  { name: 'dark-menu-color', theme: 'dark', scenario: 'connector', open: 'menu:color' },
  { name: 'light-menu-color', theme: 'light', scenario: 'connector', open: 'menu:color' },
  { name: 'light-menu-weight', theme: 'light', scenario: 'connector', open: 'menu:weight' },
  { name: 'dark-menu-kind', theme: 'dark', scenario: 'connector', open: 'menu:kind' },
  { name: 'light-menu-start', theme: 'light', scenario: 'connector', open: 'menu:startCap' },
  { name: 'dark-menu-end', theme: 'dark', scenario: 'connector', open: 'menu:endCap' },
  { name: 'light-menu-end', theme: 'light', scenario: 'connector', open: 'menu:endCap' },
  { name: 'dark-advanced', theme: 'dark', scenario: 'connector', open: 'advanced' },
  { name: 'light-advanced', theme: 'light', scenario: 'connector', open: 'advanced' },
  { name: 'dark-open-family', theme: 'dark', scenario: 'connector', open: 'advanced,family' },
  { name: 'light-open-style', theme: 'light', scenario: 'connector', open: 'advanced,style' },
  { name: 'dark-open-color', theme: 'dark', scenario: 'connector', open: 'advanced,color' },
];

const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--virtual-time-budget=5000', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

for (const s of SHOTS) {
  const url = `${BASE}/test/ui/harness.html?theme=${s.theme}&scenario=${s.scenario}${s.open ? `&open=${encodeURIComponent(s.open)}` : ''}`;
  const dom = chrome(['--window-size=320,1400', '--dump-dom', url]);
  const height = Number((dom.match(/<pre id="height"[^>]*>(\d+)<\/pre>/) || [])[1]) || 900;
  chrome([`--window-size=320,${height}`, '--force-device-scale-factor=2', `--screenshot=${OUT}${s.name}.png`, url]);
  console.log(`${s.name}.png  320×${height} @2x`);
}
