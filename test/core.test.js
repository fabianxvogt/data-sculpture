import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CAMERA, buildMesh, fitView, meshToGLB, meshToOBJ, numericValue, parseCSV, parseJSON, parseProject, profile, projectedBounds, resizeCamera } from '../src/core.js';

test('CSV retains nulls and maps known numeric range to exact normalized bounds', () => {
  const parsed = parseCSV('x,y,label\n0,10,a\n5,,b\n10,30,c\n');
  assert.equal(parsed.data.length, 3);
  assert.equal(parsed.data[1].y, null);
  const stat = profile(parsed.data, 'x');
  assert.equal(numericValue(0, stat).value, 0);
  assert.equal(numericValue(10, stat).value, 1);
  assert.equal(numericValue(null, profile(parsed.data, 'y')).missing, true);
});

test('JSON supports data envelope and rejects non-object rows', () => {
  const parsed = parseJSON('{"data":[{"a":1},{"a":2}]}');
  assert.deepEqual(parsed.data.map(r => r.a), [1, 2]);
  assert.throws(() => parseJSON('[1,2]'), /rows must be objects/);
  assert.throws(() => parseJSON('[{"x":[]},{"x":[1]},{"x":{}}]'), /must be a scalar/);
  assert.equal(numericValue(true, profile([{ x: true }], 'x')).missing, true);
});

test('strict CSV rejects malformed quotes and duplicate normalized headers', () => {
  assert.throws(() => parseCSV('x,y\n"a"b,1\n'), /unexpected text after a closing quote/);
  assert.throws(() => parseCSV('x,y\na"b,1\n'), /quote must start a field/);
  assert.throws(() => parseCSV('x,x\n1,2\n'), /duplicate header/);
  assert.throws(() => parseCSV('x, x\n1,2\n'), /duplicate header/);
});

test('project parser applies row and field caps before state can change', () => {
  const tooManyRows = JSON.stringify({ format: 'data-sculpture-project', version: 1, dataset: { name: 'huge', data: Array.from({ length: 5001 }, () => ({ x: 1 })) } });
  assert.throws(() => parseProject(tooManyRows), /row limit/);
  const tooManyFields = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`f${i}`, i]));
  assert.throws(() => parseProject(JSON.stringify({ format: 'data-sculpture-project', version: 1, dataset: { data: [tooManyFields] } })), /field limit/);
  assert.throws(() => parseProject(JSON.stringify({ format: 'data-sculpture-project', version: 1, dataset: { data: [{ x: [] }] } })), /scalar/);
});

test('project camera is complete, finite, bounded, and defaults without poisoning prior state', () => {
  const base = { format: 'data-sculpture-project', version: 1, dataset: { data: [{ x: 0 }, { x: 1 }] } };
  assert.deepEqual(parseProject(JSON.stringify(base)).camera, DEFAULT_CAMERA);
  assert.throws(() => parseProject(JSON.stringify({ ...base, camera: {} })), /include finite yaw/);
  assert.throws(() => parseProject(JSON.stringify({ ...base, camera: { yaw: 0, pitch: 0 } })), /include finite yaw/);
  assert.throws(() => parseProject(JSON.stringify({ ...base, camera: { yaw: 0, pitch: 1.2, zoom: 1 } })), /pitch/);
  assert.throws(() => parseProject(JSON.stringify({ ...base, camera: { yaw: 0, pitch: 0, zoom: 2 } })), /zoom/);
  const prior = { dataset: 'kept', camera: { ...DEFAULT_CAMERA } };
  assert.throws(() => { const candidate = parseProject(JSON.stringify({ ...base, camera: {} })); prior.dataset = candidate.dataset; prior.camera = candidate.camera; }, /include finite yaw/);
  assert.deepEqual(prior, { dataset: 'kept', camera: { ...DEFAULT_CAMERA } });
  assert.equal(parseProject(JSON.stringify({ ...base, camera: { yaw: 0, pitch: 0, zoom: 1, fitIntent: true } })).camera.fitIntent, true);
  assert.throws(() => parseProject(JSON.stringify({ ...base, camera: { yaw: 0, pitch: 0, zoom: 1, fitIntent: 'yes' } })), /fit intent/);
});

test('z-only variation produces non-degenerate surface triangles and usable normals', () => {
  const data = [{ x: 7, y: 2, z: 0, c: 1 }, { x: 7, y: 2, z: 1, c: 2 }, { x: 7, y: 2, z: 2, c: 3 }];
  const mesh = buildMesh(data, { x: 'x', y: 'y', z: 'z', radius: 'c', color: 'c' });
  let nonZero = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3).map(id => id * 3);
    const a = ids[0], b = ids[1], c = ids[2];
    const ab = [mesh.positions[b] - mesh.positions[a], mesh.positions[b + 1] - mesh.positions[a + 1], mesh.positions[b + 2] - mesh.positions[a + 2]];
    const ac = [mesh.positions[c] - mesh.positions[a], mesh.positions[c + 1] - mesh.positions[a + 1], mesh.positions[c + 2] - mesh.positions[a + 2]];
    if (Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) > 1e-8) nonZero++;
  }
  assert.equal(nonZero, mesh.indices.length / 3);
  assert.ok(mesh.normals.some(v => Math.abs(v) > 0.5));
  assert.throws(() => buildMesh([{ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }], { x: 'x', y: 'y', z: 'z', radius: 'x', color: 'x' }), /same 3D point/);
});

test('mesh fixture has finite geometry and independent export signatures', async () => {
  const data = [{ x: 0, y: 0, z: 0, c: 0 }, { x: 1, y: 2, z: 3, c: 1 }, { x: 2, y: 1, z: 2, c: 2 }];
  const mesh = buildMesh(data, { x: 'x', y: 'y', z: 'z', radius: 'c', color: 'c' });
  assert.ok(mesh.positions.length > 0 && mesh.indices.length > 0);
  assert.ok(mesh.positions.every(Number.isFinite));
  assert.equal(mesh.indices.length % 3, 0);
  assert.match(meshToOBJ(mesh), /^# Data Sculpture OBJ export/);
  const glb = new Uint8Array(await meshToGLB(mesh).arrayBuffer());
  assert.deepEqual([...glb.slice(0, 4)], [0x67, 0x6c, 0x54, 0x46]);
  assert.equal(new DataView(glb.buffer).getUint32(4, true), 2);
});

test('fit view centers LCG849 asymmetric valid mapping inside all four padded edges', () => {
  let seed = 849;
  const data = Array.from({ length: 16 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; const u = seed / 2 ** 32; return { x: 2 * u - 1, y: 2 * u - 1, z: 2 * u - 1, r: 0.1 + 9 * u, c: 100 * u }; });
  const camera = { yaw: 1.1, pitch: -0.7, zoom: 1 };
  const mesh = buildMesh(data, { x: 'x', y: 'y', z: 'z', radius: 'r', color: 'c' });
  const width = 390, height = 420, padding = 0.84, fit = fitView(mesh, width, height, camera), bounds = projectedBounds(mesh, camera, fit.zoom), scale = Math.min(width, height) * 0.27;
  const left = width / 2 + (bounds.minX - fit.panX) * scale, right = width / 2 + (bounds.maxX - fit.panX) * scale;
  const top = height / 2 - (bounds.maxY - fit.panY) * scale, bottom = height / 2 - (bounds.minY - fit.panY) * scale;
  const padX = width * (1 - padding) / 2, padY = height * (1 - padding) / 2;
  assert.ok(fit.zoom >= 0.55 && fit.zoom <= 1.7);
  assert.ok(left >= padX - 1e-6, `left ${left} < ${padX}`);
  assert.ok(right <= width - padX + 1e-6, `right ${right} > ${width - padX}`);
  assert.ok(top >= padY - 1e-6, `top ${top} < ${padY}`);
  assert.ok(bottom <= height - padY + 1e-6, `bottom ${bottom} > ${height - padY}`);
});

test('fitted view refits across 390x420 to 420x390 while manual camera stays unchanged', () => {
  let seed = 849;
  const data = Array.from({ length: 16 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; const u = seed / 2 ** 32; return { x: 2 * u - 1, y: 2 * u - 1, z: 2 * u - 1, r: 0.1 + 9 * u, c: 100 * u }; });
  const camera = { yaw: -0.45, pitch: 0.22, zoom: 1, panX: 0, panY: 0, fitIntent: true }, mesh = buildMesh(data, { x: 'x', y: 'y', z: 'z', radius: 'r', color: 'c' });
  const fitted = { ...camera, ...fitView(mesh, 390, 420, camera) }, resized = resizeCamera(mesh, 420, 390, fitted), bounds = projectedBounds(mesh, resized, resized.zoom), scale = Math.min(420, 390) * 0.27;
  const edges = { left: 420 / 2 + (bounds.minX - resized.panX) * scale, right: 420 / 2 + (bounds.maxX - resized.panX) * scale, top: 390 / 2 - (bounds.maxY - resized.panY) * scale, bottom: 390 / 2 - (bounds.minY - resized.panY) * scale }, padX = 420 * 0.16 / 2, padY = 390 * 0.16 / 2;
  assert.ok(edges.left >= padX - 1e-6 && edges.right <= 420 - padX + 1e-6 && edges.top >= padY - 1e-6 && edges.bottom <= 390 - padY + 1e-6, JSON.stringify(edges));
  const manual = { yaw: 0.7, pitch: -0.4, zoom: 1.2, panX: 0.2, panY: -0.1, fitIntent: false };
  assert.deepEqual(resizeCamera(mesh, 420, 390, manual), manual);
});

test('real app wiring validates and commits imports transactionally', async () => {
  const app = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/responsive.css', import.meta.url), 'utf8');
  assert.match(app, /parseProject\(text\)/);
  assert.match(app, /const candidateMesh = buildMesh\(incoming\.data, candidateSettings\)/);
  assert.match(app, /if \(token !== state\.importToken\) return; if \(!confirm/);
  assert.match(app, /function invalidateImports\(\) \{ state\.importToken\+\+; \}/);
  assert.match(app, /function undo\(\) \{ invalidateImports\(\)/);
  assert.match(app, /state\.dataset = incoming; state\.settings = candidateSettings; state\.camera = candidateCamera; mesh = candidateMesh/);
  assert.match(app, /download\(new Blob\(\[meshToOBJ\(mesh\)\]/);
  assert.match(app, /OBJ download started\. Use MAP for its explanation/);
  assert.doesNotMatch(app, /OBJ \+ MAP exported/);
  assert.match(app, /if \(!blob \|\| !blob\.size\)/);
  assert.match(app, /fitView\(mesh, canvas\.clientWidth, canvas\.clientHeight/);
  assert.match(app, /resizeCamera\(mesh, canvas\.clientWidth, canvas\.clientHeight/);
  assert.match(app, /state\.camera\.fitIntent = false/);
  assert.match(app, /p\.x - state\.camera\.panX/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
});
