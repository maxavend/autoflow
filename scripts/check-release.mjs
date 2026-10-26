// Checks that the built plugin and its Community listing are ready to submit from Figma's
// "Publish" dialog. Run with `npm run release` (lints, tests and builds first).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(root, file), 'utf8');
const mtime = (file) => statSync(join(root, file)).mtimeMs;
const newest = (dir) => Math.max(...readdirSync(join(root, dir)).map((f) => mtime(join(dir, f))));

const problems = [];
const ok = [];
const check = (condition, message) => (condition ? ok : problems).push(message);

const manifest = JSON.parse(read('manifest.json'));

check(Boolean(manifest.name), `manifest: nombre "${manifest.name}"`);
// Figma assigns the numeric id on the first Publish; copy it into manifest.json before submitting.
check(/^\d+$/.test(manifest.id ?? ''), `manifest: id numérico de Figma (hoy "${manifest.id}")`);
check(manifest.documentAccess === 'dynamic-page', 'manifest: documentAccess "dynamic-page"');
check(Array.isArray(manifest.networkAccess?.allowedDomains), 'manifest: networkAccess declarado');
check(Array.isArray(manifest.editorType) && manifest.editorType.length > 0, `manifest: editorType ${JSON.stringify(manifest.editorType)}`);

for (const key of ['main', 'ui']) {
  check(existsSync(join(root, manifest[key])), `manifest.${key}: ${manifest[key]} existe`);
}

// The files Figma uploads must be built from the current sources
if (existsSync(join(root, manifest.main))) {
  check(mtime(manifest.main) >= newest('src'), `${manifest.main} está compilado desde src/ actual`);
}
if (existsSync(join(root, manifest.ui))) {
  check(mtime(manifest.ui) >= newest('ui'), `${manifest.ui} está compilado desde ui/ actual`);

  const html = read(manifest.ui);
  const allowed = ['http://www.w3.org/', 'https://fig.local'];
  const urls = [...new Set(html.match(/https?:\/\/[a-zA-Z0-9.-]+[^\s"'`)<>]*/g) ?? [])]
    .filter((url) => !allowed.some((a) => url.startsWith(a)))
    .filter((url) => !/^https:\/\/github\.com\//.test(url)); // license notices
  const allowsNetwork = manifest.networkAccess.allowedDomains.some((d) => d !== 'none');
  check(allowsNetwork || urls.length === 0, `la UI no carga recursos externos${urls.length ? `: ${urls.slice(0, 3).join(', ')}` : ''}`);
  // FigUI3 (Rogie King; editor module under PolyForm Shield) and the UI3 icons (Yuan Qing Lim)
  check(html.includes('Rogie King') && html.includes('Yuan Qing Lim'), 'la UI incluye los avisos de licencias de terceros');

  ok.push(`tamaño de ${manifest.ui}: ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
}

// Listing images (recommended sizes from Figma's publishing guide): every cover/carousel page in publish/src
function pngSize(file) {
  const buffer = readFileSync(join(root, file));
  return buffer.toString('ascii', 1, 4) === 'PNG' ? [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] : null;
}
const slides = readdirSync(join(root, 'publish/src'))
  .filter((f) => /^(cover|carousel-\d+.*)\.html$/.test(f))
  .map((f) => `publish/${f.replace(/\.html$/, '.png')}`);
const LISTING_IMAGES = [['publish/icon.png', [128, 128]], ...slides.map((f) => [f, [1920, 1080]])];
for (const [file, [w, h]] of LISTING_IMAGES) {
  const size = existsSync(join(root, file)) ? pngSize(file) : null;
  const matches = Boolean(size) && size[0] === w && size[1] === h;
  const actual = size ? ` (es ${size[0]}×${size[1]})` : ' (no existe o no es PNG)';
  check(matches, `${file}: ${w}×${h} PNG${matches ? '' : actual}`);
}
check(slides.length <= 10, `carrusel: ${slides.length} imágenes (Figma admite hasta 10 con la portada)`);

for (const message of ok) console.log(`✓ ${message}`);
for (const message of problems) console.log(`✗ ${message}`);
console.log(problems.length ? `\n${problems.length} problema(s) antes de publicar.` : '\nListo para publicar desde Figma: Plugins → Manage plugins → Publish.');
process.exit(problems.length ? 1 : 0);
