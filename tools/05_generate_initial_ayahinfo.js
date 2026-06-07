const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Paths - Resolve relative to this script directory to make it portable
// tools is at: warsh-muthamma-assets/tools
const toolsDir = __dirname;
const assetsDir = path.resolve(toolsDir, '..');
const workspaceRoot = process.argv[2] || path.resolve(assetsDir, '..');

const dbPath = path.join(workspaceRoot, 'scratch/quran.ar.warsh.db');
const thumnPagesPath = path.join(assetsDir, 'data/thumn/warsh_muthamma_thumn_pages.json');

const outputDir = path.join(assetsDir, 'databases/ayahinfo/warsh_muthamma');
const outputDbPath = path.join(outputDir, 'quran.ar.warsh_muthamma.db');
const jsonOutputDir = path.join(outputDir, 'pages_json');

// Ensure output directories exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(jsonOutputDir)) {
  fs.mkdirSync(jsonOutputDir, { recursive: true });
}

// Cleaning Arabic text function
function cleanArabic(text) {
  if (!text) return "";
  // Remove diacritics, tatweel, zero-width chars, and punctuation markers
  let clean = text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08F2\u200a\u2060\u200f\u0640]/g, '');
  // Normalize spacing
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function main() {
  console.log('Starting ayahinfo generation pipeline...');

  // 1. Open Warsh text database
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Source database not found at ${dbPath}`);
    process.exit(1);
  }
  const db = new DatabaseSync(dbPath);

  // 2. Load thumn starts and page mappings
  const thumnPages = JSON.parse(fs.readFileSync(thumnPagesPath, 'utf8'));

  // Parse thumn starts directly from the app's warsh_thumun_starts.dart
  const dartPath = path.join(workspaceRoot, 'al-quran/lib/domain/services/warsh_thumun_starts.dart');
  if (!fs.existsSync(dartPath)) {
    console.error(`Error: warsh_thumun_starts.dart not found at ${dartPath}`);
    process.exit(1);
  }
  const dartContent = fs.readFileSync(dartPath, 'utf8');
  const startsPart = dartContent.split('const List<SuraAyah> warshThumunStarts = [')[1].split('];')[0];
  const regex = /SuraAyah\s*\(\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/g;
  let match;
  const thumnStarts = [];
  while (match = regex.exec(startsPart)) {
    thumnStarts.push({
      sura: parseInt(match[1]),
      ayah: parseInt(match[2])
    });
  }

  console.log(`Loaded ${thumnStarts.length} thumn starts from warsh_thumun_starts.dart.`);
  console.log(`Loaded ${thumnPages.length} thumn page mappings.`);

  // 3. Load all verses from DB in sequential order
  const versesRows = db.prepare('SELECT sura, ayah, text FROM verses ORDER BY sura, ayah').all();
  console.log(`Loaded ${versesRows.length} verses from database.`);

  // Create a fast lookup index for verses
  const versesList = versesRows.map(r => ({
    sura: Number(r.sura),
    ayah: Number(r.ayah),
    text: r.text,
    cleanLength: cleanArabic(r.text).length
  }));

  // Helper to find verse index
  function findVerseIndex(sura, ayah) {
    return versesList.findIndex(v => v.sura === sura && v.ayah === ayah);
  }

  // 4. Map thumns to their list of verses
  const thumnVerses = [];
  for (let t = 0; t < 480; t++) {
    const startSura = Number(thumnStarts[t].sura);
    const startAyah = Number(thumnStarts[t].ayah);
    
    // Manual override for Thumn 445 (Sura 65 Ayah 1 instead of whatever was mapped)
    let effStartSura = startSura;
    let effStartAyah = startAyah;
    if (t === 444) { // 0-indexed Thumn 445
      effStartSura = 65;
      effStartAyah = 1;
    }

    const startIndex = findVerseIndex(effStartSura, effStartAyah);
    if (startIndex === -1) {
      console.error(`Error: Thumn ${t + 1} start verse ${effStartSura}:${effStartAyah} not found!`);
      process.exit(1);
    }

    let endIndex = versesList.length - 1;
    if (t < 479) {
      const nextStartSura = Number(thumnStarts[t + 1].sura);
      const nextStartAyah = Number(thumnStarts[t + 1].ayah);
      let effNextSura = nextStartSura;
      let effNextAyah = nextStartAyah;
      if (t + 1 === 444) {
        effNextSura = 65;
        effNextAyah = 1;
      }
      const nextStartIndex = findVerseIndex(effNextSura, effNextAyah);
      if (nextStartIndex !== -1) {
        endIndex = nextStartIndex - 1;
      }
    }

    const verses = versesList.slice(startIndex, endIndex + 1);
    thumnVerses.push({
      thumn_number: t + 1,
      verses: verses
    });
  }

  console.log('Mapped all 480 thumns to their sequential verses.');

  // 5. Initialize page-to-verses list
  const pageVerses = Array.from({ length: 486 }, () => []);

  // Populate pages using thumn page ranges
  for (let t = 0; t < 480; t++) {
    const mapping = thumnPages[t];
    const thumnNum = mapping.thumn_number;
    const startPage = mapping.start_page;
    const endPage = mapping.end_page;
    const verses = thumnVerses[t].verses;
    const K = endPage - startPage + 1;

    // Special override for Thumn 1 (pages 1, 2, 3)
    if (thumnNum === 1) {
      // Page 1: Sura 1 Ayah 1-7
      // Page 2: Sura 2 Ayah 1-9
      // Page 3: Sura 2 Ayah 10-15
      pageVerses[1] = verses.filter(v => v.sura === 1);
      pageVerses[2] = verses.filter(v => v.sura === 2 && v.ayah >= 1 && v.ayah <= 9);
      pageVerses[3] = verses.filter(v => v.sura === 2 && v.ayah >= 10 && v.ayah <= 15);
      continue;
    }

    if (K === 1) {
      pageVerses[startPage].push(...verses);
    } else {
      // Distribute verses of thumn t across K pages proportionally
      const C_total = verses.reduce((sum, v) => sum + v.cleanLength, 0);
      const C_cum = [];
      let currentSum = 0;
      for (const v of verses) {
        currentSum += v.cleanLength;
        C_cum.push(currentSum);
      }

      const idx = [0];
      const n = verses.length;
      for (let j = 1; j < K; j++) {
        const target = j * (C_total / K);
        let bestIdx = 0;
        for (let i = 0; i < n; i++) {
          if (C_cum[i] >= target) {
            bestIdx = i;
            break;
          }
        }
        // Clamp to ensure every page gets at least one verse
        const minIdx = idx[j - 1] + 1;
        const maxIdx = n - (K - j);
        bestIdx = Math.max(minIdx, Math.min(bestIdx, maxIdx));
        idx.push(bestIdx);
      }
      idx.push(n);

      for (let j = 0; j < K; j++) {
        const pageNum = startPage + j;
        const chunk = verses.slice(idx[j], idx[j + 1]);
        pageVerses[pageNum].push(...chunk);
      }
    }
  }

  console.log('Distributed all thumn verses to pages 1-485.');

  // 6. Generate coordinates page by page
  const allHighlights = [];
  const allMarkers = [];
  const allHeaders = [];
  const allPageBands = [];
  const pagesJson = {};

  const left_margin = 0.08;
  const right_margin = 0.92;

  // Load all layout JSONs
  const layoutData = {};
  for (let p = 1; p <= 485; p++) {
    const layoutPath = path.join(jsonOutputDir.replace('pages_json', 'page_layout_json'), `page_${String(p).padLeft(3, '0')}.json`);
    try {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
      layoutData[p] = layout;
      for (const b of layout.lineBands) {
        allPageBands.push({
          page: p,
          line: b.line,
          top: Number((b.top / layout.imageHeight).toFixed(4)),
          bottom: Number((b.bottom / layout.imageHeight).toFixed(4)),
          center: Number((b.center / layout.imageHeight).toFixed(4))
        });
      }
    } catch (e) {
      console.warn(`Warning: Could not load layout for page ${p}`);
      layoutData[p] = { detectedLineCount: 15, imageHeight: 2000, lineBands: [] };
    }
  }

  for (let p = 1; p <= 485; p++) {
    const verses = pageVerses[p];
    const layout = layoutData[p];
    const line_count = layout.detectedLineCount;

    if (verses.length === 0) {
      console.warn(`Warning: Page ${p} has no verses assigned!`);
      continue;
    }

    const pageHighlights = [];
    const pageMarkers = [];
    const pageHeaders = [];

    if (p === 1) {
      // Manual preset for Page 1 (Fatiha) to look centered and not overlap ornaments
      // Sura 1 Ayah 1-7
      // We map each ayah to the actual detected manual bands 1..7.
      const fatihaLines = [
        { ayah: 1, line: 1, left: 0.30, right: 0.70 },
        { ayah: 2, line: 2, left: 0.25, right: 0.75 },
        { ayah: 3, line: 3, left: 0.28, right: 0.72 },
        { ayah: 4, line: 4, left: 0.28, right: 0.72 },
        { ayah: 5, line: 5, left: 0.25, right: 0.75 },
        { ayah: 6, line: 6, left: 0.25, right: 0.75 },
        { ayah: 7, line: 7, left: 0.20, right: 0.80 }
      ];

      for (const item of fatihaLines) {
        const highlight = {
          page: 1,
          line: item.line,
          sura: 1,
          ayah: item.ayah,
          left: item.left,
          right: item.right
        };
        pageHighlights.push(highlight);
        allHighlights.push(highlight);

        const marker = {
          page: 1,
          sura: 1,
          ayah: item.ayah,
          line: item.line,
          center_x: item.left, // Left is end of RTL text
          center_y: 0.5
        };
        pageMarkers.push(marker);
        allMarkers.push(marker);
      }

      // Sura Header for Sura 1 (normalized coordinates)
      let header_y = 0.1;
      if (layout.lineBands.length > 1) {
        header_y = layout.lineBands[1].center / layout.imageHeight;
      } else {
        header_y = (2 - 0.5) * (3480.0 / line_count) / 3480.0;
      }

      const header = {
        page: 1,
        sura: 1,
        center_x: 0.5,
        center_y: Number(header_y.toFixed(4))
      };
      pageHeaders.push(header);
      allHeaders.push(header);

    } else if (p === 2) {
      // Manual preset for Page 2 (Baqarah 1-9) to look centered and start after sura header and Bismillah
      // Sura 2 Ayah 1-9 mapped to the actual detected manual bands 1..9.
      const baqarahLines = [
        { ayah: 1, line: 1, left: 0.40, right: 0.60 }, // الم
        { ayah: 2, line: 2, left: 0.25, right: 0.75 },
        { ayah: 3, line: 3, left: 0.20, right: 0.80 },
        { ayah: 4, line: 4, left: 0.20, right: 0.80 },
        { ayah: 5, line: 5, left: 0.25, right: 0.75 },
        { ayah: 6, line: 6, left: 0.20, right: 0.80 },
        { ayah: 7, line: 7, left: 0.20, right: 0.80 },
        { ayah: 8, line: 8, left: 0.20, right: 0.80 },
        { ayah: 9, line: 9, left: 0.20, right: 0.80 }
      ];

      for (const item of baqarahLines) {
        const highlight = {
          page: 2,
          line: item.line,
          sura: 2,
          ayah: item.ayah,
          left: item.left,
          right: item.right
        };
        pageHighlights.push(highlight);
        allHighlights.push(highlight);

        const marker = {
          page: 2,
          sura: 2,
          ayah: item.ayah,
          line: item.line,
          center_x: item.left,
          center_y: 0.5
        };
        pageMarkers.push(marker);
        allMarkers.push(marker);
      }

      // Sura Header for Sura 2 (normalized coordinates)
      let header_y = 0.1;
      if (layout.lineBands.length > 1) {
        header_y = layout.lineBands[1].center / layout.imageHeight;
      } else {
        header_y = (2 - 0.5) * (3480.0 / line_count) / 3480.0;
      }

      const header = {
        page: 2,
        sura: 2,
        center_x: 0.5,
        center_y: Number(header_y.toFixed(4))
      };
      pageHeaders.push(header);
      allHeaders.push(header);

    } else {
      // Calculate total clean character count on page
      const totalChars = verses.reduce((sum, v) => sum + v.cleanLength, 0);

      // Cumulative characters
      const C_cum = [];
      let currentSum = 0;
      for (const v of verses) {
        currentSum += v.cleanLength;
        C_cum.push(currentSum);
      }

      // Wrap verses across 15 lines proportionally
      for (let i = 0; i < verses.length; i++) {
        const v = verses[i];
        const start_frac = i === 0 ? 0.0 : C_cum[i - 1] / totalChars;
        const end_frac = C_cum[i] / totalChars;

        const line_start_frac = line_count * start_frac;
        const line_end_frac = line_count * end_frac;

        // Add Highlights
        for (let l = 1; l <= line_count; l++) {
          const l_start = l - 1;
          const l_end = l;

          const o_start = Math.max(line_start_frac, l_start);
          const o_end = Math.min(line_end_frac, l_end);

          if (o_start < o_end) {
            const p_start = o_start - l_start;
            const p_end = o_end - l_start;

            // Arabic RTL text goes right to left, i.e., X from right_margin to left_margin
            const X_start = right_margin - p_start * (right_margin - left_margin);
            const X_end = right_margin - p_end * (right_margin - left_margin);

            const minX = Math.min(X_start, X_end);
            const maxX = Math.max(X_start, X_end);

            const highlight = {
              page: p,
              line: l,
              sura: v.sura,
              ayah: v.ayah,
              left: Number(minX.toFixed(4)),
              right: Number(maxX.toFixed(4))
            };

            pageHighlights.push(highlight);
            allHighlights.push(highlight);
          }
        }

        // Add Marker at end of verse
        const marker_line_idx = Math.min(line_count - 1, Math.floor(line_end_frac));
        const marker_p_end = line_end_frac - marker_line_idx;
        const marker_x = right_margin - marker_p_end * (right_margin - left_margin);

        const marker = {
          page: p,
          sura: v.sura,
          ayah: v.ayah,
          line: marker_line_idx + 1,
          center_x: Number(marker_x.toFixed(4)),
          center_y: 0.5
        };

        pageMarkers.push(marker);
        allMarkers.push(marker);

        // Add Sura Header if ayah is 1
        if (v.ayah === 1) {
          const header_line_idx = Math.min(line_count - 1, Math.floor(line_start_frac));
          let header_y = 0.1;
          if (layout.lineBands.length > header_line_idx) {
            header_y = layout.lineBands[header_line_idx].center / layout.imageHeight;
          } else {
            header_y = (header_line_idx + 0.5) * (3480.0 / line_count) / 3480.0;
          }

          const header = {
            page: p,
            sura: v.sura,
            center_x: 0.5,
            center_y: Number(header_y.toFixed(4))
          };

          pageHeaders.push(header);
          allHeaders.push(header);
        }
      }
    }

    // Save JSON files for manual review / adjustment later
    const pageData = {
      page: p,
      ayah_highlights: pageHighlights,
      ayah_markers: pageMarkers,
      sura_headers: pageHeaders
    };
    pagesJson[p] = pageData;
    fs.writeFileSync(path.join(jsonOutputDir, `page_${String(p).padLeft(3, '0')}.json`), JSON.stringify(pageData, null, 2), 'utf8');
  }

  // 7. Write to SQLite database
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
  outDb.exec(`
    CREATE TABLE IF NOT EXISTS page_line_bands (
      page INTEGER,
      line INTEGER,
      top REAL,
      bottom REAL,
      center REAL
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

  // Insert line bands
  const insertBand = outDb.prepare(`
    INSERT INTO page_line_bands (page, line, top, bottom, center)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const b of allPageBands) {
    insertBand.run(b.page, b.line, b.top, b.bottom, b.center);
  }

  // Commit Transaction
  outDb.exec('COMMIT;');

  console.log(`Successfully generated database with:
- ${allHighlights.length} highlights
- ${allMarkers.length} markers
- ${allHeaders.length} headers`);

  console.log(`JSON page coordinates saved under ${jsonOutputDir}`);
  console.log(`SQLite database saved at ${outputDbPath}`);
}

// Helper padLeft polyfill
if (!String.prototype.padLeft) {
  String.prototype.padLeft = function(length, character) {
    return this.padStart(length, character);
  };
}

main();
