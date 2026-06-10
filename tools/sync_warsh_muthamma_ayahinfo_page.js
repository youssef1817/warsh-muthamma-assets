const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function die(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    page: null,
    db: null,
    pagesDir: null,
    layoutDir: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page') args.page = Number(argv[++i]);
    else if (arg === '--db') args.db = argv[++i];
    else if (arg === '--pages-dir') args.pagesDir = argv[++i];
    else if (arg === '--layout-dir') args.layoutDir = argv[++i];
  }

  return args;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) die(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const args = parseArgs(process.argv.slice(2));
if (!Number.isInteger(args.page) || args.page < 1 || args.page > 485) {
  die('Expected --page 1..485');
}
if (!args.db || !args.pagesDir || !args.layoutDir) {
  die('Expected --db, --pages-dir and --layout-dir');
}

const pageStr = String(args.page).padStart(3, '0');
const pageJsonPath = path.join(args.pagesDir, `page_${pageStr}.json`);
const layoutJsonPath = path.join(args.layoutDir, `page_${pageStr}.json`);
const pageData = readJson(pageJsonPath);
const layoutData = readJson(layoutJsonPath);

const db = new DatabaseSync(args.db);

function run(sql, ...params) {
  db.prepare(sql).run(...params);
}

function normalizedBand(band) {
  const imageHeight = layoutData.imageHeight || 2000;
  return {
    page: args.page,
    line: band.line,
    top: Number((band.top / imageHeight).toFixed(4)),
    bottom: Number((band.bottom / imageHeight).toFixed(4)),
    center: Number((band.center / imageHeight).toFixed(4)),
  };
}

function normalizedZone(zone) {
  const imageHeight = layoutData.imageHeight || 2000;
  return {
    page: args.page,
    type: zone.type,
    top: Number((zone.top / imageHeight).toFixed(4)),
    bottom: Number((zone.bottom / imageHeight).toFixed(4)),
  };
}

db.exec('BEGIN TRANSACTION;');
try {
  for (const table of [
    'ayah_highlights',
    'ayah_markers',
    'sura_headers',
    'page_line_bands',
    'non_ayah_zones',
  ]) {
    run(`DELETE FROM ${table} WHERE page = ?`, args.page);
  }

  for (const h of pageData.ayah_highlights || []) {
    run(
      'INSERT INTO ayah_highlights (page, line, sura, ayah, "left", "right", confidence, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args.page,
      h.line,
      h.sura,
      h.ayah,
      h.left,
      h.right,
      h.confidence ?? 0.85,
      h.source || 'manual_json'
    );
  }

  for (const m of pageData.ayah_markers || []) {
    run(
      'INSERT INTO ayah_markers (page, sura, ayah, line, center_x, center_y) VALUES (?, ?, ?, ?, ?, ?)',
      args.page,
      m.sura,
      m.ayah,
      m.line,
      m.center_x,
      m.center_y
    );
  }

  for (const h of pageData.sura_headers || []) {
    run(
      'INSERT INTO sura_headers (page, sura, center_x, center_y) VALUES (?, ?, ?, ?)',
      args.page,
      h.sura,
      h.center_x,
      h.center_y
    );
  }

  for (const band of layoutData.lineBands || []) {
    const b = normalizedBand(band);
    run(
      'INSERT INTO page_line_bands (page, line, top, bottom, center) VALUES (?, ?, ?, ?, ?)',
      b.page,
      b.line,
      b.top,
      b.bottom,
      b.center
    );
  }

  for (const zone of layoutData.nonAyahZones || []) {
    const z = normalizedZone(zone);
    run(
      'INSERT INTO non_ayah_zones (page, type, top, bottom) VALUES (?, ?, ?, ?)',
      z.page,
      z.type,
      z.top,
      z.bottom
    );
  }

  db.exec('COMMIT;');
} catch (error) {
  db.exec('ROLLBACK;');
  throw error;
} finally {
  db.close();
}

console.log(
  JSON.stringify({
    page: args.page,
    highlights: (pageData.ayah_highlights || []).length,
    markers: (pageData.ayah_markers || []).length,
    headers: (pageData.sura_headers || []).length,
    lineBands: (layoutData.lineBands || []).length,
    nonAyahZones: (layoutData.nonAyahZones || []).length,
  })
);

// Update progress.json
const progressPath = path.join(path.dirname(args.db), 'progress.json');
try {
  let progress = [];
  if (fs.existsSync(progressPath)) {
    progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  }
  if (!progress.includes(args.page)) {
    progress.push(args.page);
    progress.sort((a, b) => a - b);
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  }
} catch (e) {
  console.error('Warning: could not update progress.json', e);
}
