// Input validation shared by the panel controls (and unit-tested in Node).

// "#abc", "abc", "#aabbcc", "#aabbccff" → "#aabbcc"; anything else → null.
export function normalizeHex(input) {
  const raw = String(input ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return '#' + raw.split('').map((c) => c + c).join('').toLowerCase();
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(raw)) return '#' + raw.slice(0, 6).toLowerCase();
  return null;
}

// Empty or non-numeric → null (caller restores the previous value);
// otherwise clamped to [min, max], so negatives never reach the plugin.
export function parseNumber(input, min, max) {
  const text = String(input ?? '').trim().replace(',', '.');
  if (text === '') return null;
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
