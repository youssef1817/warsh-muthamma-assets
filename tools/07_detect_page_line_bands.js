const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const pagesDir = path.join(__dirname, '../pages/warsh_muthamma_png');
const outDir = path.join(__dirname, '../databases/ayahinfo/warsh_muthamma/page_layout_json');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
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

  if (pageNum === 1 || pageNum === 2) {
    isManualOverride = true;
    const numLines = pageNum === 1 ? 7 : 9;
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
    debugMetrics = { rawBandCount: numLines, splitBands: numLines, medianHeight: bandHeight, merged: 0, tallerThan1_6: 0 };
  } else {
    // 1. Horizontal Projection
    let rowSums = new Array(height).fill(0);
    for (let y = topCrop; y < bottomCrop; y++) {
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

    // 4. Calculate Median
    let heights = bands.map(b => b.height).sort((a,b) => a - b);
    let median = heights[Math.floor(heights.length / 2)] || 1;

    // 5. Split unusually tall bands (Merged lines heuristic)
    let mergedCount = 0;
    for (let b of bands) {
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

    let tallerThan1_6 = bands.filter(b => b.height > median * 1.6).length;

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
