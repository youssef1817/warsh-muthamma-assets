const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const pagesDir = path.join(__dirname, '../pages/warsh_muthamma_png');
const outDir = path.join(__dirname, '../databases/ayahinfo/warsh_muthamma/page_layout_json');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const suraStarts = {"1":{"sura":1,"y":0.3285},"2":{"sura":2,"y":0.3001},"41":{"sura":3,"y":0.754},"62":{"sura":4,"y":0.3524},"86":{"sura":5,"y":0.4796},"104":{"sura":6,"y":0.0707},"122":{"sura":7,"y":0.7962},"142":{"sura":8,"y":0.6183},"150":{"sura":9,"y":0.5803},"167":{"sura":10,"y":0.7695},"178":{"sura":11,"y":0.5554},"190":{"sura":12,"y":0.4163},"200":{"sura":13,"y":0.179},"206":{"sura":14,"y":0.0698},"211":{"sura":15,"y":0.0707},"215":{"sura":16,"y":0.0717},"227":{"sura":17,"y":0.0728},"236":{"sura":18,"y":0.0725},"245":{"sura":19,"y":0.6842},"251":{"sura":20,"y":0.0683},"259":{"sura":21,"y":0.072},"267":{"sura":22,"y":0.0714},"275":{"sura":23,"y":0.0676},"281":{"sura":24,"y":0.2073},"289":{"sura":25,"y":0.2754},"295":{"sura":26,"y":0.0729},"302":{"sura":27,"y":0.7267},"310":{"sura":28,"y":0.0714},"318":{"sura":29,"y":0.5242},"324":{"sura":30,"y":0.6338},"329":{"sura":31,"y":0.4868},"332":{"sura":32,"y":0.3379},"335":{"sura":33,"y":0.0855},"344":{"sura":34,"y":0.0741},"349":{"sura":35,"y":0.4797},"353":{"sura":36,"y":0.8306},"358":{"sura":37,"y":0.2914},"364":{"sura":38,"y":0.0731},"368":{"sura":39,"y":0.1645},"375":{"sura":40,"y":0.0723},"382":{"sura":41,"y":0.582},"387":{"sura":42,"y":0.8449},"393":{"sura":43,"y":0.4571},"398":{"sura":44,"y":0.2644},"400":{"sura":45,"y":0.0711},"403":{"sura":46,"y":0.0695},"406":{"sura":47,"y":0.3779},"409":{"sura":48,"y":0.4343},"413":{"sura":49,"y":0.0712},"415":{"sura":50,"y":0.5578},"418":{"sura":51,"y":0.0707},"420":{"sura":52,"y":0.272},"422":{"sura":53,"y":0.335},"424":{"sura":54,"y":0.4513},"427":{"sura":55,"y":0.0701},"429":{"sura":56,"y":0.0704},"431":{"sura":57,"y":0.5081},"435":{"sura":58,"y":0.0709},"437":{"sura":59,"y":0.9032},"440":{"sura":60,"y":0.4168},"442":{"sura":61,"y":0.0676},"443":{"sura":62,"y":0.0697},"444":{"sura":63,"y":0.0721},"445":{"sura":64,"y":0.3526},"447":{"sura":65,"y":0.0722},"449":{"sura":66,"y":0.0735},"451":{"sura":67,"y":0.0713},"452":{"sura":68,"y":0.5967},"454":{"sura":69,"y":0.3206},"456":{"sura":70,"y":0.0705},"457":{"sura":71,"y":0.2801},"459":{"sura":72,"y":0.0697},"460":{"sura":73,"y":0.3868},"461":{"sura":74,"y":0.4562},"463":{"sura":75,"y":0.0715},"464":{"sura":76,"y":0.071},"465":{"sura":77,"y":0.664},"467":{"sura":78,"y":0.0726},"468":{"sura":79,"y":0.0712},"469":{"sura":80,"y":0.1645},"470":{"sura":81,"y":0.0752},"471":{"sura":83,"y":0.5541},"472":{"sura":84,"y":0.6608},"473":{"sura":85,"y":0.3743},"474":{"sura":86,"y":0.3887},"475":{"sura":88,"y":0.5926},"476":{"sura":89,"y":0.259},"477":{"sura":91,"y":0.6162},"478":{"sura":93,"y":0.6812},"479":{"sura":96,"y":0.8303},"480":{"sura":98,"y":0.4993},"481":{"sura":101,"y":0.6954},"482":{"sura":103,"y":0.5783},"483":{"sura":108,"y":0.8799},"484":{"sura":111,"y":0.7416},"485":{"sura":114,"y":0.6564}};

const manualLayouts = {
  2: {
    lineBands: [
      { top: 628, bottom: 719 },
      { top: 786, bottom: 880 },
      { top: 934, bottom: 1026 },
      { top: 1090, bottom: 1183 },
      { top: 1238, bottom: 1335 },
      { top: 1386, bottom: 1485 }
    ],
    nonAyahZones: [
      { type: 'sura_header', top: 250, bottom: 441, confidence: 1.0 },
      { type: 'basmala', top: 481, bottom: 562, confidence: 1.0 },
      { type: 'footer_note', top: 1588, bottom: 1649, confidence: 1.0 }
    ]
  },
  482: {
    lineBands: [
      { top: 283, bottom: 368 },
      { top: 406, bottom: 485 },
      { top: 529, bottom: 612 },
      { top: 646, bottom: 729 },
      { top: 766, bottom: 850 },
      { top: 1130, bottom: 1215 },
      { top: 1249, bottom: 1334 },
      { top: 1370, bottom: 1456 },
      { top: 1751, bottom: 1849 },
      { top: 1875, bottom: 1965 }
    ],
    nonAyahZones: [
      { type: 'sura_header', top: 34, bottom: 171, confidence: 1.0 },
      { type: 'basmala', top: 185, bottom: 250, confidence: 1.0 },
      { type: 'sura_header', top: 852, bottom: 990, confidence: 1.0 },
      { type: 'basmala', top: 1019, bottom: 1087, confidence: 1.0 },
      { type: 'sura_header', top: 1465, bottom: 1613, confidence: 1.0 },
      { type: 'basmala', top: 1648, bottom: 1715, confidence: 1.0 }
    ]
  },
  483: {
    lineBands: [
      { top: 323, bottom: 424 },
      { top: 442, bottom: 538 },
      { top: 567, bottom: 664 },
      { top: 691, bottom: 791 },
      { top: 1100, bottom: 1198 },
      { top: 1227, bottom: 1323 },
      { top: 1353, bottom: 1449 },
      { top: 1749, bottom: 1835 },
      { top: 1883, bottom: 1963 }
    ],
    nonAyahZones: [
      { type: 'sura_header', top: 38, bottom: 200, confidence: 1.0 },
      { type: 'basmala', top: 223, bottom: 304, confidence: 1.0 },
      { type: 'sura_header', top: 809, bottom: 970, confidence: 1.0 },
      { type: 'basmala', top: 993, bottom: 1072, confidence: 1.0 },
      { type: 'sura_header', top: 1461, bottom: 1619, confidence: 1.0 },
      { type: 'basmala', top: 1634, bottom: 1714, confidence: 1.0 }
    ]
  },
  484: {
    lineBands: [
      { top: 299, bottom: 381 },
      { top: 406, bottom: 492 },
      { top: 515, bottom: 598 },
      { top: 842, bottom: 930 },
      { top: 961, bottom: 1035 },
      { top: 1269, bottom: 1346 },
      { top: 1371, bottom: 1452 },
      { top: 1478, bottom: 1565 },
      { top: 1786, bottom: 1872 },
      { top: 1890, bottom: 1975 }
    ],
    nonAyahZones: [
      { type: 'sura_header', top: 43, bottom: 181, confidence: 1.0 },
      { type: 'basmala', top: 216, bottom: 276, confidence: 1.0 },
      { type: 'sura_header', top: 617, bottom: 755, confidence: 1.0 },
      { type: 'basmala', top: 783, bottom: 837, confidence: 1.0 },
      { type: 'sura_header', top: 1039, bottom: 1178, confidence: 1.0 },
      { type: 'basmala', top: 1198, bottom: 1253, confidence: 1.0 },
      { type: 'sura_header', top: 1581, bottom: 1712, confidence: 1.0 },
      { type: 'basmala', top: 1719, bottom: 1781, confidence: 1.0 }
    ]
  },
  485: {
    lineBands: [
      { top: 272, bottom: 344 },
      { top: 379, bottom: 451 },
      { top: 499, bottom: 536 },
      { top: 775, bottom: 844 },
      { top: 882, bottom: 951 },
      { top: 1190, bottom: 1263 },
      { top: 1291, bottom: 1361 },
      { top: 1426, bottom: 1456 },
      { top: 1699, bottom: 1768 },
      { top: 1802, bottom: 1873 },
      { top: 1903, bottom: 1971 }
    ],
    nonAyahZones: [
      { type: 'sura_header', top: 40, bottom: 173, confidence: 1.0 },
      { type: 'basmala', top: 213, bottom: 247, confidence: 1.0 },
      { type: 'sura_header', top: 544, bottom: 675, confidence: 1.0 },
      { type: 'basmala', top: 709, bottom: 744, confidence: 1.0 },
      { type: 'sura_header', top: 964, bottom: 1095, confidence: 1.0 },
      { type: 'basmala', top: 1128, bottom: 1161, confidence: 1.0 },
      { type: 'sura_header', top: 1472, bottom: 1603, confidence: 1.0 },
      { type: 'basmala', top: 1637, bottom: 1671, confidence: 1.0 }
    ]
  }
};

const manualNonAyahZones = {
  475: [
    { type: 'sura_header', top: 35, bottom: 175, confidence: 1.0 },
    { type: 'basmala', top: 205, bottom: 285, confidence: 1.0 },
    { type: 'sura_header', top: 1013, bottom: 1165, confidence: 1.0 },
    { type: 'basmala', top: 1165, bottom: 1266, confidence: 1.0 }
  ],
  477: [
    { type: 'sura_header', top: 35, bottom: 175, confidence: 1.0 },
    { type: 'basmala', top: 205, bottom: 285, confidence: 1.0 },
    { type: 'sura_header', top: 1203, bottom: 1289, confidence: 1.0 },
    { type: 'basmala', top: 1289, bottom: 1399, confidence: 1.0 }
  ],
  478: [
    { type: 'sura_header', top: 35, bottom: 175, confidence: 1.0 },
    { type: 'basmala', top: 205, bottom: 285, confidence: 1.0 },
    { type: 'sura_header', top: 1344, bottom: 1456, confidence: 1.0 },
    { type: 'basmala', top: 1456, bottom: 1531, confidence: 1.0 }
  ],
  479: [
    { type: 'sura_header', top: 35, bottom: 175, confidence: 1.0 },
    { type: 'basmala', top: 205, bottom: 290, confidence: 1.0 },
    { type: 'sura_header', top: 604, bottom: 724, confidence: 1.0 },
    { type: 'basmala', top: 754, bottom: 840, confidence: 1.0 },
    { type: 'sura_header', top: 1450, bottom: 1585, confidence: 1.0 },
    { type: 'basmala', top: 1620, bottom: 1705, confidence: 1.0 }
  ],
  480: [
    { type: 'sura_header', top: 660, bottom: 810, confidence: 1.0 },
    { type: 'basmala', top: 835, bottom: 935, confidence: 1.0 },
    { type: 'sura_header', top: 1340, bottom: 1465, confidence: 1.0 },
    { type: 'basmala', top: 1500, bottom: 1590, confidence: 1.0 }
  ],
  481: [
    { type: 'sura_header', top: 650, bottom: 795, confidence: 1.0 },
    { type: 'basmala', top: 825, bottom: 925, confidence: 1.0 },
    { type: 'sura_header', top: 1450, bottom: 1585, confidence: 1.0 },
    { type: 'basmala', top: 1620, bottom: 1700, confidence: 1.0 }
  ]
};

function subtractZonesFromBand(band, zones) {
  let segments = [{ top: band.top, bottom: band.bottom }];

  for (const zone of zones) {
    const next = [];
    for (const segment of segments) {
      if (zone.bottom <= segment.top || zone.top >= segment.bottom) {
        next.push(segment);
        continue;
      }

      if (zone.top > segment.top) {
        next.push({ top: segment.top, bottom: Math.max(segment.top, zone.top) });
      }
      if (zone.bottom < segment.bottom) {
        next.push({ top: Math.min(segment.bottom, zone.bottom), bottom: segment.bottom });
      }
    }
    segments = next;
  }

  return segments
    .map(segment => ({ ...segment, height: segment.bottom - segment.top }))
    .filter(segment => segment.height > 45);
}

async function processPage(pageNum, debug = false) {
  const pageStr = String(pageNum).padStart(3, '0');
  const imagePath = path.join(pagesDir, `page${pageStr}.png`);
  if (!fs.existsSync(imagePath)) return null;

  const { data, info } = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  
  // Smarter text region crop
  const topCrop = Math.floor(height * 0.05);
  const bottomCrop = Math.floor(height * 0.96);
  const leftCrop = Math.floor(width * 0.12);
  const rightCrop = Math.floor(width * 0.88);
  
  const textRegion = { top: topCrop, bottom: bottomCrop, left: leftCrop, right: rightCrop };
  
  let isManualOverride = false;
  let finalBands = [];
  let debugMetrics = {};
  let nonAyahZones = [];
  const manualLayout = manualLayouts[pageNum];
  const forcedNonAyahZones = manualNonAyahZones[pageNum] || [];

  if (manualLayout) {
    isManualOverride = true;
    finalBands = manualLayout.lineBands.map((b, i) => ({
      line: i + 1,
      top: b.top,
      bottom: b.bottom,
      center: Math.round((b.top + b.bottom) / 2)
    }));
    nonAyahZones = manualLayout.nonAyahZones;
    const heights = manualLayout.lineBands.map(b => b.bottom - b.top).sort((a, b) => a - b);
    debugMetrics = {
      rawBandCount: manualLayout.lineBands.length,
      splitBands: manualLayout.lineBands.length,
      medianHeight: heights[Math.floor(heights.length / 2)] || 0,
      merged: 0,
      tallerThan1_6: 0
    };
  } else if (pageNum === 1) {
    isManualOverride = true;
    const numLines = 7;
    const startY = Math.floor(height * 0.2);
    const endY = Math.floor(height * 0.8);
    const bandHeight = (endY - startY) / numLines;
    
    for (let i = 0; i < numLines; i++) {
      finalBands.push({
        line: i + 1,
        top: Math.round(startY + i * bandHeight),
        bottom: Math.round(startY + (i + 1) * bandHeight),
        center: Math.round(startY + (i + 0.5) * bandHeight)
      });
    }
    nonAyahZones.push({
      type: 'sura_header',
      top: Math.round(height * 0.05),
      bottom: startY,
      confidence: 1.0
    });
    debugMetrics = { rawBandCount: numLines, splitBands: numLines, medianHeight: bandHeight, merged: 0, tallerThan1_6: 0 };
  } else {
    if (forcedNonAyahZones.length > 0) {
      nonAyahZones = forcedNonAyahZones.map(zone => ({ ...zone }));
    }

    // 1. Horizontal Projection
    let rowSums = new Array(height).fill(0);
    for (let y = topCrop; y < bottomCrop; y++) {
      if (forcedNonAyahZones.some(zone => y >= zone.top && y <= zone.bottom)) {
        continue;
      }
      for (let x = leftCrop; x < rightCrop; x++) {
        if (data[y * width + x] < 200) {
          rowSums[y]++;
        }
      }
    }

    // 2. Real Smoothing (Window = 51 pixels) to merge harakat with body
    let smoothed = new Array(height).fill(0);
    let w = 25; 
    for (let y = topCrop + w; y < bottomCrop - w; y++) {
      let sum = 0;
      for (let i = -w; i <= w; i++) sum += rowSums[y+i];
      smoothed[y] = sum / (2*w + 1);
    }

    // 3. Peak / Valley Segmentation
    let mode = 'seek_peak'; 
    let lastPeak = {y: topCrop, val: -1};
    let lastValley = {y: topCrop, val: 999999};

    let altValleys = [topCrop];
    let peaks = [];

    for (let y = topCrop + w; y < bottomCrop - w; y++) {
      let val = smoothed[y];
      if (mode === 'seek_peak') {
        if (val > lastPeak.val) lastPeak = {y: y, val: val};
        // Drop from peak to a valley
        if (val < lastPeak.val * 0.6 && lastPeak.val > 50) { 
          peaks.push(lastPeak.y);
          mode = 'seek_valley';
          lastValley = {y: y, val: val};
        }
      } else { 
        // Seek valley
        if (val < lastValley.val) lastValley = {y: y, val: val};
        // Rise from valley to a peak
        if (val > lastValley.val * 1.5 + 20) { 
          altValleys.push(lastValley.y);
          mode = 'seek_peak';
          lastPeak = {y: y, val: val};
        }
      }
    }
    altValleys.push(bottomCrop);

    // Bands are segments between alternate valleys
    let bands = [];
    for (let i = 0; i < altValleys.length - 1; i++) {
      let top = altValleys[i];
      let bottom = altValleys[i+1];
      if (bottom - top > 30) { // filter out minor noise
        bands.push({ top, bottom, height: bottom - top });
      }
    }

    if (forcedNonAyahZones.length > 0) {
      bands = bands.flatMap(band => subtractZonesFromBand(band, forcedNonAyahZones));
    }

    // 4. Calculate Median
    let heights = bands.map(b => b.height).sort((a,b) => a - b);
    let median = heights[Math.floor(heights.length / 2)] || 1;

    // Detect non-ayah zones for surah starts
    let bandsToRemove = new Set();
    const startInfo = forcedNonAyahZones.length > 0 ? null : suraStarts[String(pageNum)];
    if (startInfo) {
      const targetY = startInfo.y * height;
      // Find matching band index that contains targetY
      let matchIdx = bands.findIndex(b => b.top <= targetY && b.bottom >= targetY);
      if (matchIdx === -1) {
        // Fallback: closest band center
        let minDist = 999999;
        for (let i = 0; i < bands.length; i++) {
          let dist = Math.abs((bands[i].top + bands[i].bottom)/2 - targetY);
          if (dist < minDist) {
            minDist = dist;
            matchIdx = i;
          }
        }
      }

      if (matchIdx !== -1) {
        let mb = bands[matchIdx];
        const hasBasmala = (startInfo.sura !== 1 && startInfo.sura !== 9);

        if (hasBasmala) {
          if (mb.height > median * 1.4) {
            // Merged header and basmala
            let splitY = Math.round(mb.top + mb.height * 0.6);
            nonAyahZones.push({ type: 'sura_header', top: mb.top, bottom: splitY, confidence: 0.95 });
            nonAyahZones.push({ type: 'basmala', top: splitY, bottom: mb.bottom, confidence: 0.95 });
            bandsToRemove.add(matchIdx);
          } else {
            // Separate bands
            nonAyahZones.push({ type: 'sura_header', top: mb.top, bottom: mb.bottom, confidence: 0.95 });
            bandsToRemove.add(matchIdx);
            // Next band is basmala
            if (matchIdx + 1 < bands.length) {
              let nextB = bands[matchIdx + 1];
              nonAyahZones.push({ type: 'basmala', top: nextB.top, bottom: nextB.bottom, confidence: 0.95 });
              bandsToRemove.add(matchIdx + 1);
            }
          }
        } else {
          // Only sura_header
          nonAyahZones.push({ type: 'sura_header', top: mb.top, bottom: mb.bottom, confidence: 0.95 });
          bandsToRemove.add(matchIdx);
        }
      }
    }

    // Filter out bands that are non-ayah zones
    let activeBands = bands.filter((_, idx) => !bandsToRemove.has(idx));

    // 5. Split unusually tall bands (Merged lines heuristic) on activeBands
    let mergedCount = 0;
    for (let b of activeBands) {
      if (b.height > median * 1.6) {
        mergedCount++;
        let splits = Math.round(b.height / median);
        let step = b.height / splits;
        for (let i = 0; i < splits; i++) {
          finalBands.push({
            top: Math.round(b.top + i * step),
            bottom: Math.round(b.top + (i+1) * step)
          });
        }
      } else {
        finalBands.push({ top: b.top, bottom: b.bottom });
      }
    }

    let tallerThan1_6 = activeBands.filter(b => b.height > median * 1.6).length;

    // Format final bands
    finalBands = finalBands.map((b, i) => ({
      line: i + 1,
      top: b.top,
      bottom: b.bottom,
      center: Math.round((b.top + b.bottom) / 2)
    }));

    debugMetrics = { 
      rawBandCount: bands.length, 
      splitBands: finalBands.length, 
      medianHeight: median, 
      merged: mergedCount, 
      tallerThan1_6: tallerThan1_6 
    };
  }
  
  const result = {
    page: pageNum,
    imageWidth: width,
    imageHeight: height,
    textRegion: textRegion,
    detectedLineCount: finalBands.length,
    lineBands: finalBands,
    nonAyahZones: nonAyahZones,
    confidence: isManualOverride ? 1.0 : 0.85,
    manualOverride: isManualOverride,
    method: "peak_valley_v2",
    debug: debugMetrics
  };
  
  fs.writeFileSync(path.join(outDir, `page_${pageStr}.json`), JSON.stringify(result, null, 2));

  if (debug) {
    console.log(`Page ${pageStr}: raw bands=${debugMetrics.rawBandCount}, merged bands split=${debugMetrics.merged}, final split bands=${debugMetrics.splitBands}, median band height=${debugMetrics.medianHeight}, bands taller than 1.6x=${debugMetrics.tallerThan1_6}`);
  }

  return finalBands.length;
}

async function run() {
  console.log('Starting Line Band Detection V2...');
  
  // Specific reference pages for debug output
  let testPages = [3, 4, 61, 250, 485];
  for (let p of testPages) {
    await processPage(p, true);
  }
  
  if (require.main === module && process.argv[2] === 'all') {
    for (let p = 1; p <= 485; p++) {
      await processPage(p, false);
    }
  }
}

run();
