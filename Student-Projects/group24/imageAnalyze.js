import util from 'util';

if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Human from '@vladmandic/human';
import * as canvas from 'canvas';
import { kmeans } from 'ml-kmeans';
import { colornames } from 'color-name-list';
import colorNamer from 'colornamer';

const colorList = colornames.filter(c => c.name && c.hex);

// Color Utilities
function simpleFindNearestColorName(r, g, b) {
  const nearest = colorNamer.rgbColorName(r, g, b);
  return {
    name: nearest,
    isSimple: true,
  };
}

function findNearestColorName(r, g, b) {
  let nearest = { simpleName: 'unknown', detailedName: 'unknown', hex: '#000000', distance: Infinity };
  const simpleNearest = simpleFindNearestColorName(r, g, b);
  if (simpleNearest) {
    nearest.simpleName = simpleNearest.name;
  }
  
  for (const color of colorList) {
    const hex = color.hex.replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);
    
    const distance = Math.sqrt(
      Math.pow(r - cr, 2) + 
      Math.pow(g - cg, 2) + 
      Math.pow(b - cb, 2)
    );
    
    if (distance < nearest.distance) {
      nearest.detailedName = color.name;
      nearest.distance = distance;
      nearest.hex = color.hex;
    }
  }
  
  return nearest;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function classifyEyeColor(h, s, l) {
  if (l < 20) return 'black';
  if (l > 70 && s < 20) return 'gray';
  if (s < 15 && l > 40) return 'gray';
  
  if (s < 30) {
    if (l < 40) return 'dark brown';
    return 'light brown';
  }
  
  if (h >= 180 && h <= 250) {
    if (l < 40) return 'dark blue';
    if (l > 60) return 'light blue';
    return 'blue';
  }
  
  if (h >= 70 && h <= 170) {
    if (s < 40) return 'hazel';
    return 'green';
  }
  
  if (h >= 30 && h <= 70) return 'amber/hazel';
  
  return 'brown';
}

function classifyHairColor(h, s, l) {
  if (l < 15) return 'black';
  if (l > 80 && s < 20) return 'white/gray';
  if (l > 65 && s < 30) return 'gray';
  
  if (l > 55) {
    if (h >= 30 && h <= 60) return 'blonde';
    if (h >= 20 && h <= 40) return 'strawberry blonde';
    return 'light brown';
  }
  
  if ((h >= 0 && h <= 30 && s > 30) || (h >= 350 && h <= 360 && s > 30)) return 'red/auburn';
  
  if (l < 25) return 'dark brown';
  if (l < 40) return 'brown';
  return 'light brown';
}

function classifySkinTone(h, s, l) {
  let tone = '';
  let fitzpatrick = '';
  
  if (l > 80) { tone = 'very fair'; fitzpatrick = 'Type I'; }
  else if (l > 70) { tone = 'fair'; fitzpatrick = 'Type II'; }
  else if (l > 55) { tone = 'medium'; fitzpatrick = 'Type III'; }
  else if (l > 40) { tone = 'olive/tan'; fitzpatrick = 'Type IV'; }
  else if (l > 25) { tone = 'brown'; fitzpatrick = 'Type V'; }
  else { tone = 'dark brown'; fitzpatrick = 'Type VI'; }
  
  let undertone = '';
  if (h >= 0 && h <= 20) undertone = 'warm';
  else if (h >= 20 && h <= 40) undertone = 'neutral-warm';
  else if (h >= 330 && h <= 360) undertone = 'cool';
  else undertone = 'neutral';
  
  return { tone, undertone, fitzpatrick };
}

function getDominantColor(pixels, numClusters = 3) {
  if (!pixels || pixels.length < numClusters) {
    if (pixels && pixels.length > 0) {
      const avg = pixels.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
      return { r: avg[0] / pixels.length, g: avg[1] / pixels.length, b: avg[2] / pixels.length };
    }
    return null;
  }
  
  try {
    const result = kmeans(pixels, numClusters, { initialization: 'kmeans++' });
    
    const clusterSizes = new Array(numClusters).fill(0);
    result.clusters.forEach(c => clusterSizes[c]++);
    
    const largestClusterIdx = clusterSizes.indexOf(Math.max(...clusterSizes));
    const dominantCentroid = result.centroids[largestClusterIdx];
    
    return {
      r: Math.round(dominantCentroid[0]),
      g: Math.round(dominantCentroid[1]),
      b: Math.round(dominantCentroid[2]),
      allCentroids: result.centroids.map((c, i) => ({
        r: Math.round(c[0]),
        g: Math.round(c[1]),
        b: Math.round(c[2]),
        size: clusterSizes[i],
        percentage: Math.round(clusterSizes[i] / pixels.length * 100)
      }))
    };
  } catch (e) {
    console.error('K-means error:', e.message);
    const avg = pixels.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
    return { r: avg[0] / pixels.length, g: avg[1] / pixels.length, b: avg[2] / pixels.length };
  }
}

function cropCanvasRegion(sourceCanvas, x, y, w, h) {
  const cropCanvas = canvas.createCanvas(Math.round(w), Math.round(h));
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(sourceCanvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h));
  return cropCanvas;
}

// Advanced Color Analysis Functions
function analyzeEyeColorAdvanced(face, imageData, imgWidth, imgHeight, sourceCanvas, debugDir, personIndex) {
  if (!face.annotations) return { color: 'unknown', confidence: 0 };
  
  const leftIris = face.annotations.leftEyeIris;
  const rightIris = face.annotations.rightEyeIris;
  
  let bestEyePixels = [];
  let usedIris = null;
  
  function extractIrisRingPixels(iris) {
    if (!iris || iris.length < 2) return [];
    
    const pixels = [];
    const irisCenter = iris[0];
    
    let irisRadius = 10;
    if (iris.length > 1) {
      let totalDist = 0;
      for (let i = 1; i < iris.length; i++) {
        totalDist += Math.sqrt(
          Math.pow(iris[i][0] - irisCenter[0], 2) + 
          Math.pow(iris[i][1] - irisCenter[1], 2)
        );
      }
      irisRadius = totalDist / (iris.length - 1);
    }
    
    const innerBound = irisRadius * 0.5;
    const outerBound = irisRadius * 0.95;
    
    for (let angle = 0; angle < 360; angle += 5) {
      const rad = angle * Math.PI / 180;
      for (let r = innerBound; r <= outerBound; r += 2) {
        const px = Math.round(irisCenter[0] + r * Math.cos(rad));
        const py = Math.round(irisCenter[1] + r * Math.sin(rad));
        
        if (px >= 0 && px < imgWidth && py >= 0 && py < imgHeight) {
          const idx = (py * imgWidth + px) * 4;
          if (idx >= 0 && idx < imageData.data.length - 3) {
            const pixelR = imageData.data[idx];
            const pixelG = imageData.data[idx + 1];
            const pixelB = imageData.data[idx + 2];
            
            const brightness = (pixelR + pixelG + pixelB) / 3;
            if (brightness > 30) {
              pixels.push([pixelR, pixelG, pixelB]);
            }
          }
        }
      }
    }
    
    return pixels;
  }
  
  if (leftIris && leftIris.length > 1) {
    bestEyePixels = extractIrisRingPixels(leftIris);
    usedIris = leftIris;
  }
  
  if (bestEyePixels.length < 50 && rightIris && rightIris.length > 1) {
    const rightPixels = extractIrisRingPixels(rightIris);
    if (rightPixels.length > bestEyePixels.length) {
      bestEyePixels = rightPixels;
      usedIris = rightIris;
    }
  }
  
  if (debugDir && usedIris && usedIris.length > 0) {
    const irisCenter = usedIris[0];
    let irisRadius = 15;
    if (usedIris.length > 1) {
      irisRadius = Math.sqrt(
        Math.pow(usedIris[1][0] - irisCenter[0], 2) + 
        Math.pow(usedIris[1][1] - irisCenter[1], 2)
      );
    }
    const cropX = Math.max(0, irisCenter[0] - irisRadius * 2);
    const cropY = Math.max(0, irisCenter[1] - irisRadius * 2);
    const cropW = Math.min(irisRadius * 4, imgWidth - cropX);
    const cropH = Math.min(irisRadius * 4, imgHeight - cropY);
    
    if (cropW > 0 && cropH > 0) {
      const eyeCropCanvas = cropCanvasRegion(sourceCanvas, cropX, cropY, cropW, cropH);
      const eyePath = path.join(debugDir, `person_${personIndex}_eye.png`);
      fs.writeFileSync(eyePath, eyeCropCanvas.toBuffer('image/png'));
    }
  }
  
  if (bestEyePixels.length < 20) {
    return { color: 'unknown', confidence: 0, reason: 'insufficient iris pixels' };
  }
  
  const dominant = getDominantColor(bestEyePixels, 4);
  if (!dominant) return { color: 'unknown', confidence: 0 };
  
  const hsl = rgbToHsl(dominant.r, dominant.g, dominant.b);
  const colorCategory = classifyEyeColor(hsl.h, hsl.s, hsl.l);
  const nearestColor = findNearestColorName(dominant.r, dominant.g, dominant.b);
  
  return {
    color: colorCategory,
    colorName: nearestColor.detailedName,
    simpleColorName: nearestColor.simpleName,
    rgb: { r: dominant.r, g: dominant.g, b: dominant.b },
    hex: rgbToHex(dominant.r, dominant.g, dominant.b),
    hsl: hsl,
    confidence: Math.min(100, Math.round(bestEyePixels.length / 100 * 100)),
    pixelCount: bestEyePixels.length,
    clusters: dominant.allCentroids
  };
}

function analyzeSkinColorAdvanced(face, imageData, imgWidth, imgHeight, sourceCanvas, debugDir, personIndex) {
  const [fx, fy, fw, fh] = face.box;
  
  const silhouette = face.annotations?.silhouette || [];
  const leftEyeIris = face.annotations?.leftEyeIris || [];
  const rightEyeIris = face.annotations?.rightEyeIris || [];
  const leftEyeUpper = face.annotations?.leftEyeUpper0 || [];
  const leftEyeLower = face.annotations?.leftEyeLower0 || [];
  const rightEyeUpper = face.annotations?.rightEyeUpper0 || [];
  const rightEyeLower = face.annotations?.rightEyeLower0 || [];
  
  let facePolygon = [];
  if (silhouette.length > 10) {
    facePolygon = silhouette.map(p => [p[0], p[1]]);
  } else {
    const centerX = fx + fw / 2;
    const centerY = fy + fh / 2;
    for (let angle = 0; angle < 360; angle += 10) {
      const rad = angle * Math.PI / 180;
      facePolygon.push([
        centerX + (fw / 2) * 0.9 * Math.cos(rad),
        centerY + (fh / 2) * 0.95 * Math.sin(rad)
      ]);
    }
  }
  
  let leftEyePolygon = [];
  let rightEyePolygon = [];
  
  if (leftEyeUpper.length > 0 && leftEyeLower.length > 0) {
    leftEyePolygon = [...leftEyeUpper.map(p => [p[0], p[1]]), ...leftEyeLower.slice().reverse().map(p => [p[0], p[1]])];
  } else if (leftEyeIris.length > 0) {
    const center = leftEyeIris[0];
    const radius = leftEyeIris.length > 1 ? 
      Math.sqrt(Math.pow(leftEyeIris[1][0] - center[0], 2) + Math.pow(leftEyeIris[1][1] - center[1], 2)) * 2 : fw * 0.08;
    for (let angle = 0; angle < 360; angle += 20) {
      const rad = angle * Math.PI / 180;
      leftEyePolygon.push([center[0] + radius * Math.cos(rad), center[1] + radius * Math.sin(rad)]);
    }
  }
  
  if (rightEyeUpper.length > 0 && rightEyeLower.length > 0) {
    rightEyePolygon = [...rightEyeUpper.map(p => [p[0], p[1]]), ...rightEyeLower.slice().reverse().map(p => [p[0], p[1]])];
  } else if (rightEyeIris.length > 0) {
    const center = rightEyeIris[0];
    const radius = rightEyeIris.length > 1 ? 
      Math.sqrt(Math.pow(rightEyeIris[1][0] - center[0], 2) + Math.pow(rightEyeIris[1][1] - center[1], 2)) * 2 : fw * 0.08;
    for (let angle = 0; angle < 360; angle += 20) {
      const rad = angle * Math.PI / 180;
      rightEyePolygon.push([center[0] + radius * Math.cos(rad), center[1] + radius * Math.sin(rad)]);
    }
  }
  
  function pointInPolygon(x, y, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  facePolygon.forEach(p => {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  });
  
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(imgWidth - 1, Math.ceil(maxX));
  maxY = Math.min(imgHeight - 1, Math.ceil(maxY));
  
  const cropW = maxX - minX;
  const cropH = maxY - minY;
  
  const skinCanvas = canvas.createCanvas(cropW, cropH);
  const skinCtx = skinCanvas.getContext('2d');
  skinCtx.clearRect(0, 0, cropW, cropH);
  
  let skinPixels = [];
  
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (!pointInPolygon(px, py, facePolygon)) continue;
      if (pointInPolygon(px, py, leftEyePolygon)) continue;
      if (pointInPolygon(px, py, rightEyePolygon)) continue;
      
      const srcIdx = (py * imgWidth + px) * 4;
      if (srcIdx >= 0 && srcIdx < imageData.data.length - 3) {
        const r = imageData.data[srcIdx];
        const g = imageData.data[srcIdx + 1];
        const b = imageData.data[srcIdx + 2];
        
        const destX = px - minX;
        const destY = py - minY;
        skinCtx.fillStyle = `rgb(${r},${g},${b})`;
        skinCtx.fillRect(destX, destY, 1, 1);
        
        const brightness = (r + g + b) / 3;
        if (brightness > 40 && brightness < 240) {
          skinPixels.push([r, g, b]);
        }
      }
    }
  }
  
  if (debugDir) {
    const skinPath = path.join(debugDir, `person_${personIndex}_skin.png`);
    fs.writeFileSync(skinPath, skinCanvas.toBuffer('image/png'));
  }
  
  if (skinPixels.length < 100) {
    return { tone: 'unknown', confidence: 0, reason: 'insufficient pixels' };
  }
  
  const dominant = getDominantColor(skinPixels, 4);
  if (!dominant) return { tone: 'unknown', confidence: 0 };
  
  const hsl = rgbToHsl(dominant.r, dominant.g, dominant.b);
  const { tone, undertone, fitzpatrick } = classifySkinTone(hsl.h, hsl.s, hsl.l);
  const nearestColor = findNearestColorName(dominant.r, dominant.g, dominant.b);
  
  return {
    tone,
    undertone,
    fitzpatrick,
    colorName: nearestColor.detailedName,
    simpleColorName: nearestColor.simpleName,
    rgb: { r: dominant.r, g: dominant.g, b: dominant.b },
    hex: rgbToHex(dominant.r, dominant.g, dominant.b),
    hsl,
    confidence: Math.min(100, Math.round(skinPixels.length / 500 * 100)),
    pixelCount: skinPixels.length,
    clusters: dominant.allCentroids
  };
}

function analyzeHairColorAdvanced(face, imageData, imgWidth, imgHeight, sourceCanvas, debugDir, personIndex) {
  const [fx, fy, fw, fh] = face.box;
  
  const hairTop = Math.max(0, fy - fh * 0.6);
  const hairBottom = fy + fh * 0.5;
  const hairLeft = Math.max(0, fx - fw * 0.3);
  const hairRight = Math.min(imgWidth, fx + fw + fw * 0.3);
  
  const cropW = Math.round(hairRight - hairLeft);
  const cropH = Math.round(hairBottom - hairTop);
  
  if (cropW <= 10 || cropH <= 10) {
    return { color: 'unknown', confidence: 0, reason: 'invalid crop region' };
  }
  
  const workCanvas = canvas.createCanvas(cropW, cropH);
  const workCtx = workCanvas.getContext('2d');
  workCtx.drawImage(sourceCanvas, Math.round(hairLeft), Math.round(hairTop), cropW, cropH, 0, 0, cropW, cropH);
  
  const cropImageData = workCtx.getImageData(0, 0, cropW, cropH);
  const pixels = cropImageData.data;
  
  const cropOffsetX = hairLeft;
  const cropOffsetY = hairTop;
  
  const silhouette = face.annotations?.silhouette || [];
  let facePolygon = [];
  if (silhouette.length > 10) {
    const centerX = silhouette.reduce((sum, p) => sum + p[0], 0) / silhouette.length;
    const centerY = silhouette.reduce((sum, p) => sum + p[1], 0) / silhouette.length;
    facePolygon = silhouette.map(p => {
      const dx = p[0] - centerX;
      const dy = p[1] - centerY;
      return [centerX + dx * 0.95 - cropOffsetX, centerY + dy * 0.95 - cropOffsetY];
    });
  } else {
    const centerX = fx + fw / 2 - cropOffsetX;
    const centerY = fy + fh / 2 - cropOffsetY;
    for (let angle = 0; angle < 360; angle += 10) {
      const rad = angle * Math.PI / 180;
      facePolygon.push([
        centerX + (fw / 2) * 0.9 * Math.cos(rad),
        centerY + (fh / 2) * 0.9 * Math.sin(rad)
      ]);
    }
  }
  
  const leftEyebrowUpper = face.annotations?.leftEyebrowUpper || [];
  const rightEyebrowUpper = face.annotations?.rightEyebrowUpper || [];
  
  let foreheadBottom = fy + fh * 0.3;
  if (leftEyebrowUpper.length > 0 && rightEyebrowUpper.length > 0) {
    const eyebrowY = Math.min(
      ...leftEyebrowUpper.map(p => p[1]),
      ...rightEyebrowUpper.map(p => p[1])
    );
    foreheadBottom = eyebrowY;
  }
  
  const foreheadTopInCrop = fy - cropOffsetY;
  const foreheadBottomInCrop = foreheadBottom - cropOffsetY;
  const foreheadLeftInCrop = fx - cropOffsetX + fw * 0.1;
  const foreheadRightInCrop = fx - cropOffsetX + fw * 0.9;
  
  const leftEyeIris = face.annotations?.leftEyeIris || [];
  const rightEyeIris = face.annotations?.rightEyeIris || [];
  
  const eyeExclusions = [];
  if (leftEyeIris.length > 0) {
    const center = leftEyeIris[0];
    eyeExclusions.push({ cx: center[0] - cropOffsetX, cy: center[1] - cropOffsetY, r: fw * 0.08 });
  }
  if (rightEyeIris.length > 0) {
    const center = rightEyeIris[0];
    eyeExclusions.push({ cx: center[0] - cropOffsetX, cy: center[1] - cropOffsetY, r: fw * 0.08 });
  }
  
  function pointInPolygon(x, y, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  

  const skinSamples = [];
  for (let py = Math.max(0, foreheadTopInCrop + 5); py < Math.min(cropH, foreheadBottomInCrop - 5); py++) {
    for (let px = Math.max(0, foreheadLeftInCrop); px < Math.min(cropW, foreheadRightInCrop); px++) {
      const idx = (py * cropW + px) * 4;
      skinSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
    }
  }
  
  let skinColor = { r: 200, g: 160, b: 140 };
  if (skinSamples.length > 20) {
    skinColor = {
      r: Math.round(skinSamples.reduce((s, p) => s + p[0], 0) / skinSamples.length),
      g: Math.round(skinSamples.reduce((s, p) => s + p[1], 0) / skinSamples.length),
      b: Math.round(skinSamples.reduce((s, p) => s + p[2], 0) / skinSamples.length)
    };
  }
  

  const bgSamples = [];
  const cornerSize = Math.max(8, Math.floor(Math.min(cropW, cropH) * 0.12));
  
  for (let py = 0; py < cornerSize; py++) {
    for (let px = 0; px < cornerSize; px++) {
      const idx = (py * cropW + px) * 4;
      bgSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
    }
  }
  for (let py = 0; py < cornerSize; py++) {
    for (let px = cropW - cornerSize; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      bgSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
    }
  }
  for (let py = cropH - cornerSize; py < cropH; py++) {
    for (let px = 0; px < cornerSize; px++) {
      const idx = (py * cropW + px) * 4;
      bgSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
    }
  }
  for (let py = cropH - cornerSize; py < cropH; py++) {
    for (let px = cropW - cornerSize; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      bgSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
    }
  }
  
  let bgColors = [];
  if (bgSamples.length > 30) {
    const bgResult = getDominantColor(bgSamples, 3);
    if (bgResult && bgResult.allCentroids) {
      bgColors = bgResult.allCentroids.map(c => ({ r: c.r, g: c.g, b: c.b }));
    }
  }
  if (bgColors.length === 0) {
    bgColors = [{ r: 200, g: 200, b: 200 }];
  }
  
  const resultCanvas = canvas.createCanvas(cropW, cropH);
  const resultCtx = resultCanvas.getContext('2d');
  resultCtx.clearRect(0, 0, cropW, cropH);
  
  const resultImageData = resultCtx.createImageData(cropW, cropH);
  const resultPixels = resultImageData.data;
  
  for (let i = 0; i < pixels.length; i++) {
    resultPixels[i] = pixels[i];
  }
  

  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const hsl = rgbToHsl(r, g, b);
      
      let isBackground = false;
      
      for (const bgColor of bgColors) {
        const bgDist = Math.sqrt(
          Math.pow(r - bgColor.r, 2) + 
          Math.pow(g - bgColor.g, 2) + 
          Math.pow(b - bgColor.b, 2)
        );
        if (bgDist < 40) {
          isBackground = true;
          break;
        }
      }
      
      if (hsl.l > 90) isBackground = true;
      if (hsl.s < 10 && hsl.l > 65) isBackground = true;
      
      const edgeDist = Math.min(px, py, cropW - 1 - px, cropH - 1 - py);
      if (edgeDist < cornerSize) {
        for (const bgColor of bgColors) {
          const bgDist = Math.sqrt(
            Math.pow(r - bgColor.r, 2) + 
            Math.pow(g - bgColor.g, 2) + 
            Math.pow(b - bgColor.b, 2)
          );
          if (bgDist < 60) {
            isBackground = true;
            break;
          }
        }
      }
      
      if (isBackground) {
        resultPixels[idx + 3] = 0;
      }
    }
  }
  
  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      for (const eye of eyeExclusions) {
        const dist = Math.sqrt(Math.pow(px - eye.cx, 2) + Math.pow(py - eye.cy, 2));
        if (dist < eye.r) {
          const idx = (py * cropW + px) * 4;
          resultPixels[idx + 3] = 0;
          break;
        }
      }
    }
  }
  
  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      if (resultPixels[idx + 3] === 0) continue;
      
      const r = resultPixels[idx];
      const g = resultPixels[idx + 1];
      const b = resultPixels[idx + 2];
      
      if (pointInPolygon(px, py, facePolygon)) {
        resultPixels[idx + 3] = 0;
        continue;
      }
      
      if (py >= foreheadTopInCrop && py <= foreheadBottomInCrop + 10 &&
          px >= foreheadLeftInCrop - 10 && px <= foreheadRightInCrop + 10) {
        const skinDist = Math.sqrt(
          Math.pow(r - skinColor.r, 2) + 
          Math.pow(g - skinColor.g, 2) + 
          Math.pow(b - skinColor.b, 2)
        );
        if (skinDist < 50) {
          resultPixels[idx + 3] = 0;
          continue;
        }
      }
      
      const skinDist = Math.sqrt(
        Math.pow(r - skinColor.r, 2) + 
        Math.pow(g - skinColor.g, 2) + 
        Math.pow(b - skinColor.b, 2)
      );
      
      if (skinDist < 35) {
        resultPixels[idx + 3] = 0;
      }
    }
  }
  
  let hairPixels = [];
  for (let py = 0; py < cropH; py++) {
    for (let px = 0; px < cropW; px++) {
      const idx = (py * cropW + px) * 4;
      if (resultPixels[idx + 3] > 0) {
        hairPixels.push([resultPixels[idx], resultPixels[idx + 1], resultPixels[idx + 2]]);
      }
    }
  }
  
  resultCtx.putImageData(resultImageData, 0, 0);
  
  if (debugDir) {
    const hairPath = path.join(debugDir, `person_${personIndex}_hair.png`);
    fs.writeFileSync(hairPath, resultCanvas.toBuffer('image/png'));
  }
  
  if (hairPixels.length < 50) {
    return { color: 'unknown', confidence: 0, reason: 'insufficient hair pixels or bald', pixelCount: hairPixels.length };
  }
  
  const dominant = getDominantColor(hairPixels, 5);
  if (!dominant) return { color: 'unknown', confidence: 0 };
  
  const hsl = rgbToHsl(dominant.r, dominant.g, dominant.b);
  const colorCategory = classifyHairColor(hsl.h, hsl.s, hsl.l);
  const nearestColor = findNearestColorName(dominant.r, dominant.g, dominant.b);
  
  return {
    color: colorCategory,
    colorName: nearestColor.detailedName,
    simpleColorName: nearestColor.simpleName,
    rgb: { r: dominant.r, g: dominant.g, b: dominant.b },
    hex: rgbToHex(dominant.r, dominant.g, dominant.b),
    hsl,
    confidence: Math.min(100, Math.round(hairPixels.length / 500 * 100)),
    pixelCount: hairPixels.length,
    cropSize: { width: cropW, height: cropH },
    backgroundColors: bgColors,
    skinColor: skinColor,
    clusters: dominant.allCentroids
  };
}

// Analysis Helper Functions
function getHeadDirection(rotation) {
  if (!rotation || !rotation.angle) return { direction: 'unknown', details: null };
  
  const pitch = rotation.angle.pitch || 0;
  const yaw = rotation.angle.yaw || 0;
  const roll = rotation.angle.roll || 0;
  
  const pitchDeg = pitch * 180 / Math.PI;
  const yawDeg = yaw * 180 / Math.PI;
  const rollDeg = roll * 180 / Math.PI;
  
  let vertical = 'straight';
  let horizontal = 'center';
  
  if (pitchDeg > 15) vertical = 'down';
  else if (pitchDeg < -15) vertical = 'up';
  
  if (yawDeg > 15) horizontal = 'left';
  else if (yawDeg < -15) horizontal = 'right';
  
  let direction = '';
  if (vertical === 'straight' && horizontal === 'center') {
    direction = 'facing center';
  } else if (vertical !== 'straight' && horizontal !== 'center') {
    direction = `facing ${horizontal}-${vertical}`;
  } else if (vertical !== 'straight') {
    direction = `facing ${vertical}`;
  } else {
    direction = `facing ${horizontal}`;
  }
  
  return {
    direction,
    pitchDegrees: Math.round(pitchDeg),
    yawDegrees: Math.round(yawDeg),
    rollDegrees: Math.round(rollDeg),
    vertical,
    horizontal,
  };
}

function getGazeDirection(rotation) {
  if (!rotation || !rotation.gaze) return { direction: 'unknown', strength: 0 };
  
  const bearing = rotation.gaze.bearing || 0;
  const strength = rotation.gaze.strength || 0;
  
  const bearingDeg = bearing * 180 / Math.PI;
  
  let direction = 'center';
  if (strength > 0.1) {
    if (bearingDeg > 45 && bearingDeg <= 135) direction = 'up';
    else if (bearingDeg > 135 && bearingDeg <= 225) direction = 'left';
    else if (bearingDeg > 225 && bearingDeg <= 315) direction = 'down';
    else direction = 'right';
  }
  
  return {
    direction,
    bearingDegrees: Math.round(bearingDeg),
    strengthPercent: Math.round(strength * 100),
  };
}

function getBodyPosture(body, gestures) {
  if (!body) return null;
  
  const bodyGestures = gestures.filter(g => g.part && g.part.includes('body'));
  
  let posture = 'unknown';
  let lean = 'none';
  
  if (body.keypoints) {
    const keypointMap = {};
    body.keypoints.forEach(kp => { keypointMap[kp.part] = kp; });
    
    const leftHip = keypointMap['leftHip'];
    const rightHip = keypointMap['rightHip'];
    const leftKnee = keypointMap['leftKnee'];
    const rightKnee = keypointMap['rightKnee'];
    const leftShoulder = keypointMap['leftShoulder'];
    const rightShoulder = keypointMap['rightShoulder'];
    
    if (leftHip && rightHip && leftKnee && rightKnee) {
      const hipY = (leftHip.position[1] + rightHip.position[1]) / 2;
      const kneeY = (leftKnee.position[1] + rightKnee.position[1]) / 2;
      const hipKneeDistance = Math.abs(kneeY - hipY);
      
      if (hipKneeDistance < 50) {
        posture = 'sitting';
      } else {
        posture = 'standing';
      }
    }
    
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderCenterX = (leftShoulder.position[0] + rightShoulder.position[0]) / 2;
      const hipCenterX = (leftHip.position[0] + rightHip.position[0]) / 2;
      const leanAmount = shoulderCenterX - hipCenterX;
      
      if (leanAmount > 20) lean = 'leaning right';
      else if (leanAmount < -20) lean = 'leaning left';
      else lean = 'upright';
    }
  }
  
  return { posture, lean, gesturesDetected: bodyGestures.map(g => g.gesture) };
}

// Human.js Configuration
const humanConfig = {
  backend: 'tensorflow',
  modelBasePath: 'https://vladmandic.github.io/human/models/',
  cacheModels: true,
  filter: { enabled: false },
  face: {
    enabled: true,
    detector: { enabled: true, maxDetected: 20, rotation: true, return: true, minConfidence: 0.3 },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true },
    emotion: { enabled: true },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { 
    enabled: true, 
    maxDetected: 20,
    minConfidence: 0.1,
    modelPath: 'movenet-lightning.json',
  },
  hand: { 
    enabled: true, 
    maxDetected: 20,
    minConfidence: 0.3,
  },
  gesture: { enabled: true },
  object: { enabled: false },
  segmentation: { enabled: false },
};

let humanInstance = null;

async function getHumanInstance() {
  if (!humanInstance) {
    humanInstance = new Human.Human(humanConfig);
    await humanInstance.load();
    await humanInstance.warmup();
  }
  return humanInstance;
}

/**
 * Analyze image buffer for face, body, and hand detection
 * @param {Buffer} imageBuffer - Image data to analyze
 * @param {Object} options - Configuration options
 * @param {boolean} options.debug - Enable debug output
 * @param {string} options.debugDir - Directory for debug files
 * @returns {Promise<Object>} Analysis results with faces, annotated image, and JSON data
 */
export async function analyzeImage(imageBuffer, options = {}) {
  const { debug = false, debugDir = null } = options;
  
  const human = await getHumanInstance();
  
  const img = await canvas.loadImage(imageBuffer);
  const imgCanvas = canvas.createCanvas(img.width, img.height);
  const ctx = imgCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const inputTensor = human.tf.tensor(imageData.data, [img.height, img.width, 4], 'int32');
  const rgbTensor = human.tf.slice(inputTensor, [0, 0, 0], [-1, -1, 3]);
  const floatTensor = human.tf.cast(rgbTensor, 'float32');
  const batchedTensor = human.tf.expandDims(floatTensor, 0);
  
  const result = await human.detect(batchedTensor);
  
  inputTensor.dispose();
  rgbTensor.dispose();
  floatTensor.dispose();
  batchedTensor.dispose();
  
  const peopleData = [];
  const faceImages = [];
  

  if (result.face && result.face.length > 0) {
    for (let index = 0; index < result.face.length; index++) {
      const face = result.face[index];
      
      const headDirection = getHeadDirection(face.rotation);
      const gazeDirection = getGazeDirection(face.rotation);
      

      let leftEyeState = 'open';
      let rightEyeState = 'open';
      let mouthState = 'closed';
      let mouthOpenPercent = null;
      
      const faceGestures = (result.gesture || []).filter(g => g.face === index || g.iris === index);
      
      faceGestures.forEach(g => {
        if (g.gesture.includes('blink left eye')) leftEyeState = 'closed';
        else if (g.gesture.includes('left eye')) leftEyeState = g.gesture.replace('left eye ', '');
        
        if (g.gesture.includes('blink right eye')) rightEyeState = 'closed';
        else if (g.gesture.includes('right eye')) rightEyeState = g.gesture.replace('right eye ', '');
        
        if (g.gesture.includes('mouth')) {
          const match = g.gesture.match(/mouth (\d+)% open/);
          if (match) {
            mouthOpenPercent = parseInt(match[1]);
            if (mouthOpenPercent < 10) mouthState = 'closed';
            else if (mouthOpenPercent < 30) mouthState = 'slightly open';
            else if (mouthOpenPercent < 60) mouthState = 'open';
            else mouthState = 'wide open';
          }
        }
      });
      

      const [fx, fy, fw, fh] = face.box;
      

      const facePadding = Math.max(fw, fh) * 0.2;
      const tightCropX = Math.max(0, Math.round(fx - facePadding));
      const tightCropY = Math.max(0, Math.round(fy - facePadding));
      const tightCropW = Math.min(Math.round(fw + facePadding * 2), img.width - tightCropX);
      const tightCropH = Math.min(Math.round(fh + facePadding * 2), img.height - tightCropY);
      
      const faceCanvas = canvas.createCanvas(tightCropW, tightCropH);
      const faceCtx = faceCanvas.getContext('2d');
      faceCtx.drawImage(img, tightCropX, tightCropY, tightCropW, tightCropH, 0, 0, tightCropW, tightCropH);
      

      const faceBuffer = faceCanvas.toBuffer('image/png');
      faceImages.push({ index: index, buffer: faceBuffer });
      

      const hairPadding = fh * 0.8;
      const sidePadding = fw * 0.4;
      const bottomPadding = fh * 0.15;
      
      const extCropX = Math.max(0, Math.round(fx - sidePadding));
      const extCropY = Math.max(0, Math.round(fy - hairPadding));
      const extCropW = Math.min(Math.round(fw + sidePadding * 2), img.width - extCropX);
      const extCropH = Math.min(Math.round(fh + hairPadding + bottomPadding), img.height - extCropY);
      
      const personCanvas = canvas.createCanvas(extCropW, extCropH);
      const personCtx = personCanvas.getContext('2d');
      personCtx.drawImage(img, extCropX, extCropY, extCropW, extCropH, 0, 0, extCropW, extCropH);
      
      const croppedImageData = personCtx.getImageData(0, 0, extCropW, extCropH);
      

      const adjustedFace = {
        ...face,
        box: [fx - extCropX, fy - extCropY, fw, fh],
        annotations: {}
      };
      
      if (face.annotations) {
        for (const [key, points] of Object.entries(face.annotations)) {
          if (Array.isArray(points)) {
            adjustedFace.annotations[key] = points.map(p => {
              if (Array.isArray(p)) {
                return [p[0] - extCropX, p[1] - extCropY, ...(p.slice(2))];
              }
              return p;
            });
          }
        }
      }
      

      const actualDebugDir = debug ? debugDir : null;
      const eyeColorAnalysis = analyzeEyeColorAdvanced(adjustedFace, croppedImageData, extCropW, extCropH, personCanvas, actualDebugDir, index);
      const hairColorAnalysis = analyzeHairColorAdvanced(adjustedFace, croppedImageData, extCropW, extCropH, personCanvas, actualDebugDir, index);
      const skinToneAnalysis = analyzeSkinColorAdvanced(adjustedFace, croppedImageData, extCropW, extCropH, personCanvas, actualDebugDir, index);
      

      const personData = {
        personIndex: index,
        face: {
          id: face.id,
          score: Math.round((face.score || 0) * 100),
          box: face.box,
          age: face.age ? Math.round(face.age * 10) / 10 : null,
          gender: face.gender,
          genderScore: face.genderScore ? Math.round(face.genderScore * 100) : null,
          emotion: face.emotion ? face.emotion.map(e => ({
            emotion: e.emotion,
            score: Math.round(e.score * 100),
          })) : null,
          primaryEmotion: face.emotion && face.emotion.length > 0 ? {
            emotion: face.emotion[0].emotion,
            score: Math.round(face.emotion[0].score * 100),
          } : null,
          headDirection,
          gazeDirection,
          eyes: {
            left: leftEyeState,
            right: rightEyeState,
            bothOpen: leftEyeState === 'open' && rightEyeState === 'open',
            blinking: leftEyeState === 'closed' || rightEyeState === 'closed',
          },
          mouth: {
            state: mouthState,
            openPercent: mouthOpenPercent,
          },
          distance: face.distance ? {
            meters: Math.round(face.distance * 100) / 100,
            description: face.distance < 0.5 ? 'very close' : 
                         face.distance < 1 ? 'close' : 
                         face.distance < 2 ? 'medium' : 'far',
          } : null,
          real: face.real ? Math.round(face.real * 100) : null,
          live: face.live ? Math.round(face.live * 100) : null,
          eyeColor: eyeColorAnalysis,
          hairColor: hairColorAnalysis,
          skinTone: skinToneAnalysis,
        },
        faceGestures: faceGestures.map(g => g.gesture),
      };
      
      peopleData.push(personData);
    }
  }
  
  if (result.body && result.body.length > 0) {
    result.body.forEach((body, bodyIndex) => {
      const postureAnalysis = getBodyPosture(body, result.gesture || []);
      
      const bodyData = {
        id: body.id,
        score: Math.round((body.score || 0) * 100),
        box: body.box,
        posture: postureAnalysis,
        keypoints: body.keypoints ? body.keypoints.map(kp => ({
          part: kp.part,
          position: kp.position,
          score: Math.round((kp.score || 0) * 100),
        })) : null,
      };
      

      const [bx, by, bw, bh] = body.box;
      const bodyCenterX = bx + bw / 2;
      let headY = by;
      
      if (body.keypoints) {
        const nose = body.keypoints.find(kp => kp.part === 'nose');
        if (nose) headY = nose.position[1];
      }
      
      let bestMatch = -1;
      let bestDistance = Infinity;
      
      if (result.face) {
        result.face.forEach((face, faceIndex) => {
          const [fx, fy, fw, fh] = face.box;
          const faceCenterX = fx + fw / 2;
          const faceCenterY = fy + fh / 2;
          
          const dx = faceCenterX - bodyCenterX;
          const dy = faceCenterY - headY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < bestDistance && distance < bh * 0.5) {
            bestDistance = distance;
            bestMatch = faceIndex;
          }
        });
      }
      
      if (bestMatch >= 0 && peopleData[bestMatch]) {
        peopleData[bestMatch].body = bodyData;
      } else {
        peopleData.push({ 
          personIndex: peopleData.length + 1, 
          body: bodyData,
          note: 'Body detected without matching face'
        });
      }
    });
  }
  

  if (result.hand && result.hand.length > 0) {
    result.hand.forEach((hand, index) => {
      const handGestures = (result.gesture || []).filter(g => g.hand === index).map(g => g.gesture);
      
      const handData = {
        id: hand.id,
        score: Math.round((hand.score || 0) * 100),
        box: hand.box,
        label: hand.label,
        gestures: handGestures,
      };
      
      const personIndex = Math.floor(index / 2);
      if (peopleData[personIndex]) {
        if (!peopleData[personIndex].hands) {
          peopleData[personIndex].hands = [];
        }
        peopleData[personIndex].hands.push(handData);
      }
    });
  }
  

  const outputJson = {
    timestamp: new Date().toISOString(),
    imageInfo: {
      width: img.width,
      height: img.height,
    },
    summary: {
      totalFaces: result.face ? result.face.length : 0,
      totalBodies: result.body ? result.body.length : 0,
      totalHands: result.hand ? result.hand.length : 0,
      totalGestures: result.gesture ? result.gesture.length : 0,
    },
    people: peopleData,
    allGestures: result.gesture || [],
  };
  
  const annotatedCanvas = canvas.createCanvas(img.width, img.height);
  const annotatedCtx = annotatedCanvas.getContext('2d');
  
  annotatedCtx.drawImage(img, 0, 0);
  
  const drawOptions = {
    drawAttention: true,
    drawBoxes: true,
    drawPoints: true,
    drawLabels: false,
    drawGestures: false,
    drawPolygons: true,
    drawGaze: true,
    fillPolygons: false,
    useDepth: true,
    useCurves: false,
  };
  
  await human.draw.all(annotatedCanvas, result, drawOptions);
  
  if (result.face && result.face.length > 0) {
    result.face.forEach((face, index) => {
      const [fx, fy, fw, fh] = face.box;
      

      annotatedCtx.fillStyle = '#00ff00';
      annotatedCtx.font = 'bold 24px Arial';
      annotatedCtx.strokeStyle = '#000000';
      annotatedCtx.lineWidth = 4;
      const label = `Person ${index}`;
      annotatedCtx.strokeText(label, fx, fy - 10);
      annotatedCtx.fillText(label, fx, fy - 10);
      

      let infoY = fy + fh + 25;
      annotatedCtx.fillStyle = '#ffffff';
      annotatedCtx.font = '14px Arial';
      annotatedCtx.strokeStyle = '#000000';
      annotatedCtx.lineWidth = 3;
      
      const personData = peopleData[index];
      
      if (face.age) {
        const text = `Age: ${Math.round(face.age)}`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      if (face.gender) {
        const text = `Gender: ${face.gender}`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.mouth) {
        const mouthText = personData.face.mouth.openPercent !== null 
          ? `Mouth: ${personData.face.mouth.state} (${personData.face.mouth.openPercent}%)`
          : `Mouth: ${personData.face.mouth.state}`;
        annotatedCtx.strokeText(mouthText, fx, infoY);
        annotatedCtx.fillText(mouthText, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.hairColor && personData.face.hairColor.colorName) {
        const text = `Hair: ${personData.face.hairColor.colorName} (${personData.face.hairColor.simpleColorName})`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.eyeColor && personData.face.eyeColor.colorName) {
        const text = `Eyes: ${personData.face.eyeColor.colorName} (${personData.face.eyeColor.simpleColorName})`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.eyes) {
        let eyeStateText = 'Eyes: ';
        if (personData.face.eyes.bothOpen) {
          eyeStateText += 'both open';
        } else if (personData.face.eyes.blinking) {
          eyeStateText += 'blinking';
        } else if (personData.face.eyes.left === 'closed' && personData.face.eyes.right === 'closed') {
          eyeStateText += 'both closed';
        } else {
          eyeStateText += `L: ${personData.face.eyes.left}, R: ${personData.face.eyes.right}`;
        }
        annotatedCtx.strokeText(eyeStateText, fx, infoY);
        annotatedCtx.fillText(eyeStateText, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.skinTone && personData.face.skinTone.colorName) {
        const text = `Skin: ${personData.face.skinTone.colorName} (${personData.face.skinTone.simpleColorName})`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.headDirection) {
        const text = `Head: ${personData.face.headDirection.direction}`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.gazeDirection) {
        const text = `Gaze: ${personData.face.gazeDirection.direction}`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.distance && personData.face.distance.meters) {
        const text = `Distance: ${personData.face.distance.meters}m (${personData.face.distance.description})`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (personData && personData.face.primaryEmotion) {
        const primary = personData.face.primaryEmotion;
        const text = `Primary: ${primary.emotion} (${primary.score}%)`;
        annotatedCtx.strokeText(text, fx, infoY);
        annotatedCtx.fillText(text, fx, infoY);
        infoY += 18;
      }
      

      if (face.emotion && face.emotion.length > 0) {
        face.emotion.forEach((emo, emoIndex) => {
          const text = `${emo.emotion}: ${Math.round(emo.score * 100)}%`;
          annotatedCtx.strokeText(text, fx, infoY);
          annotatedCtx.fillText(text, fx, infoY);
          infoY += 18;
        });
      }
    });
  }
  

  const annotatedBuffer = annotatedCanvas.toBuffer('image/jpeg', { quality: 0.95 });
  
  if (debug) {
    const annotatedPath = './annotated.jpg';
    fs.writeFileSync(annotatedPath, annotatedBuffer);
    console.log(`Saved annotated image: ${annotatedPath}`);
  }
  
  return {
    json: outputJson,
    faces: faceImages,
    annotated: annotatedBuffer,
  };
}

// Standalone Execution
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === currentFilePath;

if (isMainModule) {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.error('Usage: node imageAnalyze.js <image_path>');
    console.error('Example: node imageAnalyze.js ./example.jpg');
    process.exit(1);
  }
  
  const currentDir = path.dirname(currentFilePath);
  const absoluteImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(currentDir, imagePath);
  
  if (!fs.existsSync(absoluteImagePath)) {
    console.error(`Image not found: ${absoluteImagePath}`);
    process.exit(1);
  }
  
  console.log('Loading Human.js models...');
  console.log(`Processing image: ${absoluteImagePath}`);
  

  const imageBuffer = fs.readFileSync(absoluteImagePath);
  

  const facesDir = path.join(currentDir, 'faces');
  if (!fs.existsSync(facesDir)) {
    fs.mkdirSync(facesDir, { recursive: true });
  }
  

  const result = await analyzeImage(imageBuffer, { debug: true, debugDir: facesDir });
  

  for (const faceImg of result.faces) {
    const facePath = path.join(facesDir, `person_${faceImg.index}.png`);
    fs.writeFileSync(facePath, faceImg.buffer);
    console.log(`Saved face: ${facePath}`);
  }
  

  const outputJsonPath = path.join(currentDir, 'output.json');
  fs.writeFileSync(outputJsonPath, JSON.stringify(result.json, null, 2));
  console.log(`Saved JSON: ${outputJsonPath}`);
  
  console.log('\n=== Detection Summary ===');
  console.log(`Faces detected: ${result.json.summary.totalFaces}`);
  console.log(`Bodies detected: ${result.json.summary.totalBodies}`);
  console.log(`Hands detected: ${result.json.summary.totalHands}`);
  console.log('\nProcessing complete!');
}

export default analyzeImage;
