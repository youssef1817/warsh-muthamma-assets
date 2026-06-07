const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Paths - Resolve relative to this script directory to make it portable
// tools is at: warsh-muthamma-assets/tools
const toolsDir = __dirname;
const assetsDir = path.resolve(toolsDir, '..');
const outputDir = path.join(assetsDir, 'databases/ayahinfo/warsh_muthamma');
const outputDbPath = path.join(outputDir, 'quran.ar.warsh_muthamma.db');
const jsonOutputDir = path.join(outputDir, 'pages_json');

function main() {
  console.log('Starting ayahinfo rebuild pipeline from JSON files...');

  if (!fs.existsSync(jsonOutputDir)) {
    console.error(`Error: JSON source directory not found at ${jsonOutputDir}`);
    process.exit(1);
  }

  // 1. Find all JSON files
  const files = fs.readdirSync(jsonOutputDir).filter(f => f.endsWith('.json')).sort();
  console.log(`Found ${files.length} JSON page files to process.`);

  const allHighlights = [];
  const allMarkers = [];
  const allHeaders = [];

  // 2. Parse each JSON file
  for (const file of files) {
    const filePath = path.join(jsonOutputDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.ayah_highlights) {
        allHighlights.push(...data.ayah_highlights);
      }
      if (data.ayah_markers) {
        allMarkers.push(...data.ayah_markers);
      }
      if (data.sura_headers) {
        allHeaders.push(...data.sura_headers);
      }
    } catch (err) {
      console.error(`Error reading or parsing ${file}:`, err);
      process.exit(1);
    }
  }

  // 3. Re-create SQLite database
  let outDb;
  try {
    if (fs.existsSync(outputDbPath)) {
      fs.unlinkSync(outputDbPath);
    }
    outDb = new DatabaseSync(outputDbPath);
  } catch (err) {
    console.warn('Warning: Could not unlink existing database file (probably locked). Reusing file and dropping tables...');
    outDb = new DatabaseSync(outputDbPath);
    outDb.exec(`
      DROP TABLE IF EXISTS ayah_highlights;
      DROP TABLE IF EXISTS ayah_markers;
      DROP TABLE IF EXISTS sura_headers;
    `);
  }

  // Create tables
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS ayah_highlights (
      page INTEGER,
      line INTEGER,
      sura INTEGER,
      ayah INTEGER,
      "left" REAL,
      "right" REAL
    );
  `);
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS ayah_markers (
      page INTEGER,
      sura INTEGER,
      ayah INTEGER,
      line INTEGER,
      center_x REAL,
      center_y REAL
    );
  `);
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS sura_headers (
      page INTEGER,
      sura INTEGER,
      center_x REAL,
      center_y REAL
    );
  `);

  // Create indexes
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_highlights_page ON ayah_highlights (page);`);
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_markers_page ON ayah_markers (page);`);
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_headers_page ON sura_headers (page);`);

  // Begin Transaction for fast inserts
  outDb.exec('BEGIN TRANSACTION;');

  // Insert highlights
  const insertHighlight = outDb.prepare(`
    INSERT INTO ayah_highlights (page, line, sura, ayah, "left", "right")
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const h of allHighlights) {
    insertHighlight.run(h.page, h.line, h.sura, h.ayah, h.left, h.right);
  }

  // Insert markers
  const insertMarker = outDb.prepare(`
    INSERT INTO ayah_markers (page, sura, ayah, line, center_x, center_y)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const m of allMarkers) {
    insertMarker.run(m.page, m.sura, m.ayah, m.line, m.center_x, m.center_y);
  }

  // Insert headers
  const insertHeader = outDb.prepare(`
    INSERT INTO sura_headers (page, sura, center_x, center_y)
    VALUES (?, ?, ?, ?)
  `);
  for (const sh of allHeaders) {
    insertHeader.run(sh.page, sh.sura, sh.center_x, sh.center_y);
  }

  // Commit Transaction
  outDb.exec('COMMIT;');

  console.log(`Rebuild completed successfully!
Database written to: ${outputDbPath}
- ${allHighlights.length} highlights
- ${allMarkers.length} markers
- ${allHeaders.length} headers`);
}

main();
