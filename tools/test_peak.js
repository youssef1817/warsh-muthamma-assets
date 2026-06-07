const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const pagesDir = path.join(__dirname, '../pages/warsh_muthamma_png');

async function testPage(pageNum) {
  const pageStr = String(pageNum).padStart(3, '0');
  const imagePath = path.join(pagesDir, `page${pageStr}.png`);
  if (!fs.existsSync(imagePath)) return;

  const { data, info } = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  
  const topCrop = Math.floor(height * 0.05);
  const bottomCrop = Math.floor(height * 0.96);
  const leftCrop = Math.floor(width * 0.12);
  const rightCrop = Math.floor(width * 0.88);
  
  let rowSums = new Array(height).fill(0);
  for (let y = topCrop; y < bottomCrop; y++) {
    for (let x = leftCrop; x < rightCrop; x++) {
      if (data[y * width + x] < 200) {
        rowSums[y]++;
      }
    }
  }

  // Smooth (Window = 40 to merge harakat with body)
  let smoothed = new Array(height).fill(0);
  let w = 25; // 25 up, 25 down -> 51 pixels total
  for (let y = topCrop + w; y < bottomCrop - w; y++) {
    let sum = 0;
    for (let i = -w; i <= w; i++) sum += rowSums[y+i];
    smoothed[y] = sum / (2*w + 1);
  }

  // Find valleys (local minima)
  // A valley is a point that is lower than its surroundings in a window
  let valleys = [topCrop];
  
  let valleyWindow = 30;
  for (let y = topCrop + w + valleyWindow; y < bottomCrop - w - valleyWindow; y++) {
    let isValley = true;
    let val = smoothed[y];
    // Must be the strict minimum in its window
    for (let i = -valleyWindow; i <= valleyWindow; i++) {
      if (i !== 0 && smoothed[y+i] < val) {
        isValley = false;
        break;
      }
    }
    // And must be relatively low
    if (isValley && val < 400) { // arbitrary max threshold for valley
       valleys.push(y);
    }
  }
  
  // Actually, searching for local minima in a window is good, but might trigger multiple times on flat valleys.
  // Let's refine valley detection:
  // Find all regions where smoothed[y] is below a dynamic threshold
  // Or just peak-valley alternations.
  
  let mode = 'seek_peak'; 
  let lastPeak = {y: topCrop, val: -1};
  let lastValley = {y: topCrop, val: 999999};

  let altValleys = [topCrop];
  let peaks = [];

  for (let y = topCrop + w; y < bottomCrop - w; y++) {
    let val = smoothed[y];
    if (mode === 'seek_peak') {
      if (val > lastPeak.val) lastPeak = {y: y, val: val};
      // drop from peak to a valley
      if (val < lastPeak.val * 0.6 && lastPeak.val > 50) { 
        peaks.push(lastPeak.y);
        mode = 'seek_valley';
        lastValley = {y: y, val: val};
      }
    } else { // seek_valley
      if (val < lastValley.val) lastValley = {y: y, val: val};
      // rise from valley to a peak
      if (val > lastValley.val * 1.5 + 20) { 
        altValleys.push(lastValley.y);
        mode = 'seek_peak';
        lastPeak = {y: y, val: val};
      }
    }
  }
  altValleys.push(bottomCrop);

  // Bands from altValleys
  let bands = [];
  for (let i = 0; i < altValleys.length - 1; i++) {
    let top = altValleys[i];
    let bottom = altValleys[i+1];
    if (bottom - top > 30) {
      bands.push({ top, bottom, height: bottom - top });
    }
  }

  // Calculate median
  let heights = bands.map(b => b.height).sort((a,b) => a - b);
  let median = heights[Math.floor(heights.length / 2)] || 1;

  let mergedCount = 0;
  // Split tall bands
  let finalBands = [];
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
      finalBands.push(b);
    }
  }

  let tallerThan1_6 = bands.filter(b => b.height > median * 1.6).length;

  console.log(`Page ${pageStr}: raw bands=${bands.length}, split bands=${finalBands.length}, median height=${median}, merged=${mergedCount}, >1.6x=${tallerThan1_6}`);
}

async function run() {
  await testPage(3);
  await testPage(4);
  await testPage(61);
  await testPage(250);
  await testPage(485);
}
run();
