export const LIMITS = { bytes: 1_000_000, rows: 5_000, fields: 32 };
export const DEFAULT_CAMERA = Object.freeze({ yaw: -0.45, pitch: 0.22, zoom: 1, panX: 0, panY: 0, fitIntent: false });

export const DEMO = {
  name: 'Tidal Archive',
  description: 'A synthetic 48-hour tide log: height bends the spine, energy expands it.',
  data: Array.from({ length: 72 }, (_, i) => {
    const hour = i * 40;
    const tide = 1.8 + Math.sin(i / 4.7) * 1.25 + Math.sin(i / 10.5) * 0.35;
    const energy = 0.35 + (Math.cos(i / 7.5) + 1) * 0.3 + Math.sin(i / 2.1) * 0.05;
    const salinity = 31 + Math.sin(i / 9) * 3 + Math.cos(i / 3.8);
    return { minute: hour, tide_m: Number(tide.toFixed(3)), energy: Number(energy.toFixed(3)), salinity_psu: Number(salinity.toFixed(3)), station: i % 3 === 0 ? 'NORTH' : i % 3 === 1 ? 'EAST' : 'SOUTH' };
  }),
};

function fail(message) { throw new Error(message); }

export function validateSize(text, label = 'input') {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > LIMITS.bytes) fail(`${label} is ${Math.ceil(bytes / 1024)} KB; the browser limit is 1 MB.`);
  return bytes;
}

export function parseCSV(text) {
  validateSize(text, 'CSV');
  const rows = [];
  let row = [], cell = '', mode = 'unquoted';
  const endRow = () => {
    row.push(cell);
    cell = '';
    if (row.some(v => v.trim() !== '')) rows.push(row);
    row = [];
    if (rows.length > LIMITS.rows + 1) fail(`CSV exceeds the ${LIMITS.rows.toLocaleString()} row limit.`);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (mode === 'quoted') {
      if (ch === '"' && next === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { mode = 'after-quote'; continue; }
      cell += ch;
      continue;
    }
    if (mode === 'after-quote') {
      if (ch === ',') { row.push(cell); cell = ''; mode = 'unquoted'; continue; }
      if (ch === '\n' || ch === '\r') { if (ch === '\r' && next === '\n') i++; endRow(); mode = 'unquoted'; continue; }
      fail(`CSV has unexpected text after a closing quote near character ${i + 1}.`);
    }
    if (ch === '"') {
      if (cell !== '') fail(`CSV quote must start a field near character ${i + 1}.`);
      mode = 'quoted';
    } else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && next === '\n') i++; endRow(); }
    else cell += ch;
  }
  if (mode === 'quoted') fail('CSV has an unterminated quoted field.');
  if (cell || row.length || mode === 'after-quote') endRow();
  if (rows.length < 2) fail('CSV needs a header row and at least one data row.');
  const headers = rows[0].map((h, i) => h.trim() || `field_${i + 1}`);
  if (headers.length > LIMITS.fields) fail(`CSV exceeds the ${LIMITS.fields}-field limit.`);
  if (new Set(headers).size !== headers.length) fail('CSV has duplicate header names after trimming; rename them before importing.');
  const data = rows.slice(1, LIMITS.rows + 1).map((values, ri) => {
    if (values.length !== headers.length) fail(`Row ${ri + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((h, i) => [h, coerce(values[i])]));
  });
  return { name: 'Imported CSV', data: validateDataset(data, 'CSV dataset') };
}

export function parseJSON(text) {
  validateSize(text, 'JSON');
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail('JSON could not be parsed. Check commas, quotes, and brackets.'); }
  const data = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.data) ? parsed.data : null;
  if (!data || !data.length) fail('JSON must be a non-empty array of objects, or an object with a data array.');
  if (data.length > LIMITS.rows) fail(`JSON exceeds the ${LIMITS.rows.toLocaleString()} row limit.`);
  if (data.some(v => !v || typeof v !== 'object' || Array.isArray(v))) fail('JSON rows must be objects with named fields.');
  const fields = [...new Set(data.flatMap(Object.keys))];
  if (fields.length > LIMITS.fields) fail(`JSON exceeds the ${LIMITS.fields}-field limit.`);
  const normalized = data.map((row, ri) => Object.fromEntries(fields.map(f => [f, jsonScalar(row[f], `row ${ri + 1}, field ${f}`)])));
  return { name: 'Imported JSON', data: validateDataset(normalized, 'JSON dataset') };
}

function coerce(value) {
  const v = value.trim();
  if (!v || /^(null|na|n\/a)$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && v !== '' ? n : v;
}

function jsonScalar(value, location) {
  if (value == null) return null;
  if (typeof value === 'object' || typeof value === 'function') fail(`JSON ${location} must be a scalar; arrays and objects cannot map to coordinates.`);
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (!['string', 'number', 'boolean'].includes(typeof value)) fail(`JSON ${location} has an unsupported value type.`);
  return value;
}

export function validateDataset(data, label = 'dataset') {
  if (!Array.isArray(data) || !data.length) fail(`${label} must contain at least one row.`);
  if (data.length > LIMITS.rows) fail(`${label} exceeds the ${LIMITS.rows.toLocaleString()} row limit.`);
  const fields = [...new Set(data.flatMap(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`${label} rows must be objects.`);
    for (const [field, value] of Object.entries(row)) {
      if (value !== null && (typeof value === 'object' || typeof value === 'function')) fail(`${label} field ${field} must be a scalar; arrays and objects are not supported.`);
      if (typeof value === 'number' && !Number.isFinite(value)) fail(`${label} field ${field} contains a non-finite number; use null instead.`);
    }
    return Object.keys(row);
  }))];
  if (fields.length > LIMITS.fields) fail(`${label} exceeds the ${LIMITS.fields}-field limit.`);
  return data;
}

export function parseProject(text) {
  validateSize(text, 'project');
  let project;
  try { project = JSON.parse(text); } catch { fail('Project JSON could not be parsed.'); }
  if (!project || project.format !== 'data-sculpture-project' || project.version !== 1) fail('Unsupported project version.');
  const dataset = validateDataset(project.dataset?.data, 'embedded project dataset');
  const settings = project.settings && typeof project.settings === 'object' && !Array.isArray(project.settings) ? project.settings : {};
  return { dataset: { ...project.dataset, data: dataset }, settings, camera: normalizeCamera(project.camera) };
}

export function normalizeCamera(camera) {
  if (camera === undefined || camera === null) return { ...DEFAULT_CAMERA };
  if (!camera || typeof camera !== 'object' || Array.isArray(camera)) fail('Project camera must be an object or omitted.');
  if (!['yaw', 'pitch', 'zoom'].every(key => Object.prototype.hasOwnProperty.call(camera, key))) fail('Project camera must include finite yaw, pitch, and zoom values.');
  if (['yaw', 'pitch', 'zoom'].some(key => !Number.isFinite(camera[key]))) fail('Project camera values must be finite numbers.');
  if (camera.pitch < -1.1 || camera.pitch > 1.1) fail('Project camera pitch must be between -1.1 and 1.1 radians.');
  if (camera.zoom < 0.55 || camera.zoom > 1.7) fail('Project camera zoom must be between 0.55 and 1.7.');
  if (['panX', 'panY'].some(key => camera[key] !== undefined && (!Number.isFinite(camera[key]) || camera[key] < -10 || camera[key] > 10))) fail('Project camera pan values must be finite and bounded between -10 and 10.');
  const wrappedYaw = ((camera.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  if (camera.fitIntent !== undefined && typeof camera.fitIntent !== 'boolean') fail('Project camera fit intent must be a boolean.');
  return { yaw: wrappedYaw, pitch: camera.pitch, zoom: camera.zoom, panX: camera.panX ?? 0, panY: camera.panY ?? 0, fitIntent: camera.fitIntent ?? false };
}

export function projectedBounds(mesh, camera = DEFAULT_CAMERA, zoom = 1) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw), cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    const perspective = 3.8 / (3.8 - z2);
    const px = x1 * perspective * zoom, py = y1 * perspective * zoom;
    bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px);
    bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py);
  }
  return { ...bounds, width: Number.isFinite(bounds.minX) ? bounds.maxX - bounds.minX : 0, height: Number.isFinite(bounds.minY) ? bounds.maxY - bounds.minY : 0 };
}

export function fitZoom(mesh, width, height, camera = DEFAULT_CAMERA, padding = 0.84) {
  if (!(width > 0 && height > 0)) return 1;
  const bounds = projectedBounds(mesh, camera, 1), scale = Math.min(width, height) * 0.27;
  const widthZoom = bounds.width ? (width * padding) / (bounds.width * scale) : 1.7;
  const heightZoom = bounds.height ? (height * padding) / (bounds.height * scale) : 1.7;
  return Math.max(0.55, Math.min(1.7, Math.min(widthZoom, heightZoom)));
}

export function fitView(mesh, width, height, camera = DEFAULT_CAMERA, padding = 0.84) {
  const zoom = fitZoom(mesh, width, height, camera, padding), bounds = projectedBounds(mesh, camera, zoom);
  if (!bounds.width && !bounds.height) return { zoom, panX: 0, panY: 0 };
  return { zoom, panX: (bounds.minX + bounds.maxX) / 2, panY: (bounds.minY + bounds.maxY) / 2 };
}

export function resizeCamera(mesh, width, height, camera) {
  return camera.fitIntent ? { ...camera, ...fitView(mesh, width, height, camera) } : { ...camera };
}

export function columns(data) {
  return [...new Set(data.flatMap(Object.keys))];
}

export function profile(data, field) {
  const values = data.map(row => row[field]);
  const numeric = values.filter(isNumericScalar).map(Number);
  const missing = values.length - numeric.length;
  const finite = numeric.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  const mean = finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : 0;
  const spread = finite.length > 1 ? Math.sqrt(finite.reduce((a, b) => a + (b - mean) ** 2, 0) / finite.length) : 0;
  const extreme = spread ? values.filter(v => isNumericScalar(v) && Math.abs(Number(v) - mean) > spread * 3).length : 0;
  const cats = [...new Set(values.filter(v => v !== null && v !== '').map(String))];
  return { field, count: values.length, missing, numeric: finite.length, min, max, mean, spread, extreme, categories: cats.length, sample: values.slice(0, 3) };
}

function isNumericScalar(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
}

export function numericValue(value, stat) {
  if (!isNumericScalar(value)) return { value: 0.5, missing: true };
  const n = Number(value);
  if (stat.max === stat.min) return { value: 0.5, missing: false };
  return { value: Math.max(0, Math.min(1, (n - stat.min) / (stat.max - stat.min))), missing: false };
}

function colorFor(value, stat, missing) {
  const t = missing ? 0.02 : numericValue(value, stat).value;
  const hue = 0.68 - t * 0.62;
  const s = 0.76, l = 0.56;
  const f = (n) => { const k = (n + hue * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

export function buildMesh(data, settings) {
  const xs = profile(data, settings.x), ys = profile(data, settings.y), zs = profile(data, settings.z), cs = profile(data, settings.color);
  const positions = [], colors = [], indices = [], sides = 8;
  const centers = data.map((row, i) => {
    const xn = numericValue(row[settings.x], xs), yn = numericValue(row[settings.y], ys), zn = numericValue(row[settings.z], zs);
    const radius = 0.035 + numericValue(row[settings.radius], profile(data, settings.radius)).value * 0.095;
    return { x: (xn.value - 0.5) * 2.7, y: (yn.value - 0.5) * 2.25, z: (zn.value - 0.5) * 2.7, r: radius, missing: xn.missing || yn.missing || zn.missing };
  });
  for (let i = 1; i < centers.length; i++) {
    const a = centers[i - 1], b = centers[i];
    if (a.x === b.x && a.y === b.y && a.z === b.z && a.r === b.r) fail(`Rows ${i} and ${i + 1} map to the same 3D point; choose a field with variation before exporting.`);
  }
  centers.forEach((p, i) => {
    const prev = centers[Math.max(0, i - 1)], next = centers[Math.min(centers.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y, dz = next.z - prev.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const tx = dx / len, ty = dy / len, tz = dz / len;
    const reference = Math.abs(tx) < 0.8 ? [1, 0, 0] : Math.abs(ty) < 0.8 ? [0, 1, 0] : [0, 0, 1];
    const bx0 = ty * reference[2] - tz * reference[1], by0 = tz * reference[0] - tx * reference[2], bz0 = tx * reference[1] - ty * reference[0];
    const bl = Math.hypot(bx0, by0, bz0) || 1;
    const bx = bx0 / bl, by = by0 / bl, bz = bz0 / bl;
    const nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
    const color = colorFor(data[i][settings.color], cs, p.missing);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      positions.push(p.x + p.r * (bx * ca + nx * sa), p.y + p.r * (by * ca + ny * sa), p.z + p.r * (bz * ca + nz * sa));
      colors.push(...color);
    }
    if (i) for (let s = 0; s < sides; s++) { const a = (i - 1) * sides + s, b = (i - 1) * sides + (s + 1) % sides, c = i * sides + (s + 1) % sides, d = i * sides + s; indices.push(a, b, d, b, c, d); }
  });
  const normals = new Array(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
    const ab = [positions[ib] - positions[ia], positions[ib + 1] - positions[ia + 1], positions[ib + 2] - positions[ia + 2]], ac = [positions[ic] - positions[ia], positions[ic + 1] - positions[ia + 1], positions[ic + 2] - positions[ia + 2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const id of [ia, ib, ic]) { normals[id] += n[0]; normals[id + 1] += n[1]; normals[id + 2] += n[2]; }
  }
  for (let i = 0; i < normals.length; i += 3) { const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1; normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l; }
  return { positions, normals, colors, indices, pointCount: data.length, triangleCount: indices.length / 3 };
}

export function meshToOBJ(mesh) {
  const lines = ['# Data Sculpture OBJ export', 'o data_sculpture'];
  for (let i = 0; i < mesh.positions.length; i += 3) lines.push(`v ${mesh.positions[i].toFixed(6)} ${mesh.positions[i + 1].toFixed(6)} ${mesh.positions[i + 2].toFixed(6)}`);
  for (let i = 0; i < mesh.normals.length; i += 3) lines.push(`vn ${mesh.normals[i].toFixed(6)} ${mesh.normals[i + 1].toFixed(6)} ${mesh.normals[i + 2].toFixed(6)}`);
  for (let i = 0; i < mesh.indices.length; i += 3) { const a = mesh.indices[i] + 1, b = mesh.indices[i + 1] + 1, c = mesh.indices[i + 2] + 1; lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`); }
  return lines.join('\n') + '\n';
}

function pad4(n) { return (4 - (n % 4)) % 4; }
function chunk(type, bytes, fill = 0) { const out = new Uint8Array(8 + bytes.length + pad4(bytes.length)); new DataView(out.buffer).setUint32(0, bytes.length, true); new DataView(out.buffer).setUint32(4, type, true); out.set(bytes, 8); if (fill) out.fill(fill, 8 + bytes.length); return out; }

export function meshToGLB(mesh, metadata = {}) {
  const pos = new Float32Array(mesh.positions), norm = new Float32Array(mesh.normals), col = new Float32Array(mesh.colors), idx = new Uint32Array(mesh.indices);
  const align = (a) => { const out = new Uint8Array(a.byteLength + pad4(a.byteLength)); out.set(new Uint8Array(a.buffer)); return out; };
  const pOff = 0, nOff = pOff + align(pos).length, cOff = nOff + align(norm).length, iOff = cOff + align(col).length;
  const bin = new Uint8Array(iOff + align(idx).length); bin.set(align(pos), pOff); bin.set(align(norm), nOff); bin.set(align(col), cOff); bin.set(align(idx), iOff);
  const min = [0, 0, 0], max = [0, 0, 0]; for (let i = 0; i < pos.length; i += 3) { for (let j = 0; j < 3; j++) { min[j] = i ? Math.min(min[j], pos[i + j]) : pos[i + j]; max[j] = i ? Math.max(max[j], pos[i + j]) : pos[i + j]; } }
  const json = JSON.stringify({ asset: { version: '2.0', generator: 'Data Sculpture v1' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Data Sculpture' }], meshes: [{ name: 'Data Sculpture', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, mode: 4 }] }], buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: pOff, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: nOff, byteLength: norm.byteLength, target: 34962 }, { buffer: 0, byteOffset: cOff, byteLength: col.byteLength, target: 34962 }, { buffer: 0, byteOffset: iOff, byteLength: idx.byteLength, target: 34963 }], accessors: [{ bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5126, count: norm.length / 3, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: col.length / 3, type: 'VEC3' }, { bufferView: 3, componentType: 5125, count: idx.length, type: 'SCALAR' }], extras: metadata });
  const jbytes = new TextEncoder().encode(json); const jc = chunk(0x4E4F534A, jbytes, 0x20); const bc = chunk(0x004E4942, bin); const out = new Uint8Array(12 + jc.length + bc.length); const dv = new DataView(out.buffer); dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true); out.set(jc, 12); out.set(bc, 12 + jc.length); return new Blob([out], { type: 'model/gltf-binary' });
}

export function download(blob, filename) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('download has no bytes to save.');
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a);
  try { a.click(); } finally {
    window.setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30_000);
  }
}
