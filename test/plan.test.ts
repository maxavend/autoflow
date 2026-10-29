import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capFromFigma, dashFromPattern, dashPattern, endpointSpec, facing, mergeOrder, pairsFor, pointOn, sideOf, sortBy } from '../src/plan.ts';

test('pairs: pair, chain and fan; fewer than two → none', () => {
  assert.deepEqual(pairsFor(['a', 'b', 'c'], 'pair'), [['a', 'b']]);
  assert.deepEqual(pairsFor(['a', 'b', 'c'], 'chain'), [['a', 'b'], ['b', 'c']]);
  assert.deepEqual(pairsFor(['a', 'b', 'c'], 'fan'), [['a', 'b'], ['a', 'c']]);
  assert.deepEqual(pairsFor(['a'], 'chain'), []);
});

test('click order is kept, new ids appended, gone ids dropped', () => {
  assert.deepEqual(mergeOrder(['b', 'a'], ['a', 'b', 'c']), ['b', 'a', 'c']);
  assert.deepEqual(mergeOrder(['b', 'a'], ['a']), ['a']);
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(sortBy(items, ['c', 'a']).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(sortBy(items, []).map((x) => x.id), ['a', 'b', 'c']);
});

test('anchors: auto and centred sides use magnets, other points exact positions', () => {
  assert.deepEqual(endpointSpec('1', 'auto', 0.3, 200, 100), { endpointNodeId: '1', magnet: 'AUTO' });
  assert.deepEqual(endpointSpec('1', 'left', 0.5, 200, 100), { endpointNodeId: '1', magnet: 'LEFT' });
  assert.deepEqual(endpointSpec('1', 'top', 0.25, 200, 100), { endpointNodeId: '1', position: { x: 50, y: 0 } });
  assert.deepEqual(endpointSpec('1', 'right', 0.8, 200, 100), { endpointNodeId: '1', position: { x: 200, y: 80 } });
});

test('anchors read back to the same side and position', () => {
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    for (const t of [0.1, 0.5, 0.75]) {
      const spec = endpointSpec('1', side, t, 200, 100) as { magnet?: string; position?: { x: number; y: number } };
      assert.deepEqual(sideOf(spec, 200, 100), { side, t }, `${side} ${t}`);
    }
  }
  assert.deepEqual(sideOf({ magnet: 'AUTO' }, 200, 100), { side: 'auto', t: 0.5 });
  assert.deepEqual(sideOf({ magnet: 'CENTER' }, 200, 100), { side: 'auto', t: 0.5 });
  assert.deepEqual(sideOf({ position: { x: 90, y: 40 } }, 200, 100), { side: 'auto', t: 0.5 }); // inside
});

test('facing side and points aimed at a layer inside its parent', () => {
  const box = { x: 100, y: 100, width: 100, height: 50 };
  assert.equal(facing(box, { x: 400, y: 120, width: 10, height: 10 }), 'right');
  assert.equal(facing(box, { x: 0, y: 100, width: 10, height: 50 }), 'left');
  assert.equal(facing(box, { x: 120, y: 500, width: 10, height: 10 }), 'bottom');
  assert.equal(facing(box, { x: 120, y: -300, width: 10, height: 10 }), 'top');
  const outer = { x: 80, y: 60, width: 300, height: 300 };
  assert.deepEqual(pointOn(box, outer, 'right', 0.5), { x: 120, y: 65 });
  assert.deepEqual(pointOn(box, outer, 'top', 0.25), { x: 45, y: 40 });
});

test('dash patterns scale with weight and read back', () => {
  assert.deepEqual(dashPattern('solid', 2), []);
  assert.deepEqual(dashPattern('dash', 2), [8, 6]);
  assert.deepEqual(dashPattern('dot', 3), [3, 6]);
  for (const d of ['solid', 'dash', 'dot'] as const) assert.equal(dashFromPattern(dashPattern(d, 2)), d);
});

test('caps map both ways; unknown Figma caps read as an arrow', () => {
  assert.equal(capFromFigma('TRIANGLE_FILLED'), 'triangle');
  assert.equal(capFromFigma('NONE'), 'none');
  assert.equal(capFromFigma('ERD_MANY'), 'arrow');
});
