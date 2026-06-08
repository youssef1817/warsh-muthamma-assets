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
  const allPageBands = [];
  const allNonAyahZones = [];

  const layoutDir = path.join(outputDir, 'page_layout_json');

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
    
    const layoutPath = path.join(layoutDir, file);
    try {
      if (fs.existsSync(layoutPath)) {
        const layoutData = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
        if (layoutData.lineBands) {
          const imgHeight = layoutData.imageHeight || 2000;
          for (const b of layoutData.lineBands) {
            allPageBands.push({
              page: parseInt(file.replace('page_', '').replace('.json', '')),
              line: b.line,
              top: Number((b.top / imgHeight).toFixed(4)),
              bottom: Number((b.bottom / imgHeight).toFixed(4)),
              center: Number((b.center / imgHeight).toFixed(4))
            });
          }
        }
        if (layoutData.nonAyahZones) {
          const imgHeight = layoutData.imageHeight || 2000;
          for (const zone of layoutData.nonAyahZones) {
            allNonAyahZones.push({
              page: parseInt(file.replace('page_', '').replace('.json', '')),
              type: zone.type,
              top: Number((zone.top / imgHeight).toFixed(4)),
              bottom: Number((zone.bottom / imgHeight).toFixed(4))
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error reading or parsing layout for ${file}:`, err);
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
      DROP TABLE IF EXISTS page_line_bands;
      DROP TABLE IF EXISTS non_ayah_zones;
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
      "right" REAL,
      confidence REAL,
      source TEXT
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
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS page_line_bands (
      page INTEGER,
      line INTEGER,
      top REAL,
      bottom REAL,
      center REAL
    );
  `);
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS non_ayah_zones (
      page INTEGER,
      type TEXT,
      top REAL,
      bottom REAL
    );
  `);

  // Create indexes
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_highlights_page ON ayah_highlights (page);`);
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_markers_page ON ayah_markers (page);`);
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_headers_page ON sura_headers (page);`);
  outDb.exec(`CREATE INDEX IF NOT EXISTS idx_non_ayah_page ON non_ayah_zones (page);`);

  // Begin Transaction for fast inserts
  outDb.exec('BEGIN TRANSACTION;');

  // Insert highlights
  const insertHighlight = outDb.prepare(`
    INSERT INTO ayah_highlights (page, line, sura, ayah, "left", "right", confidence, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const h of allHighlights) {
    insertHighlight.run(h.page, h.line, h.sura, h.ayah, h.left, h.right, h.confidence || 0.85, h.source || "text_proportional");
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

  // Insert line bands
  const insertBand = outDb.prepare(`
    INSERT INTO page_line_bands (page, line, top, bottom, center)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const b of allPageBands) {
    insertBand.run(b.page, b.line, b.top, b.bottom, b.center);
  }

  // Insert non-ayah zones
  const insertNonAyah = outDb.prepare(`
    INSERT INTO non_ayah_zones (page, type, top, bottom)
    VALUES (?, ?, ?, ?)
  `);
  for (const z of allNonAyahZones) {
    insertNonAyah.run(z.page, z.type, z.top, z.bottom);
  }

  // Commit Transaction
  outDb.exec('COMMIT;');

  console.log(`Rebuild completed successfully!
Database written to: ${outputDbPath}
- ${allHighlights.length} highlights
- ${allMarkers.length} markers
- ${allHeaders.length} headers
- ${allNonAyahZones.length} non-ayah zones`);
}

main();
