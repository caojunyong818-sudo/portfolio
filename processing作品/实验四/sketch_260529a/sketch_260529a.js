let cam;
let prevFrame;
let cameraReady = false;
let demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
let demoLayer;
let audioContext;
let analyser;
let audioData;
let micState = "未开启";
let soundLevel = 0;
let bassLevel = 0;
let lastSoundBurst = 0;
let particles = [];
let motionActivity = 0;
let motionTracks = [];
let nextMotionTrackId = 1;
let demoPreviousPosition = null;

let gridSize = 2;
let cols;
let rows;
let prevWave;
let curWave;
let damping = 0.982;
let fadeRate = 0.992;

let refractionStrength = 18;
let motionThreshold = 30;
let motionBlockSize = 28;
let motionSampleStep = 7;
let motionSearchRadius = 14;
let maxMotionSplashes = 58;
let fanMotionThreshold = 58;
let fanHorizontalThreshold = 3.8;

function setup() {
  let canvas = createCanvas(900, 600);
  canvas.parent("sketch-holder");
  pixelDensity(1);
  frameRate(30);

  cols = floor(width / gridSize) + 3;
  rows = floor(height / gridSize) + 3;
  prevWave = makeWaveGrid();
  curWave = makeWaveGrid();

  demoLayer = createGraphics(width, height);
  demoLayer.pixelDensity(1);
  document.getElementById("mic-button").addEventListener("click", enableMicrophone);
  document.getElementById("demo-button").addEventListener("click", toggleDemoMode);
  if (demoMode) document.getElementById("demo-button").textContent = "使用摄像头";

  if (!demoMode) startCamera();
}

function draw() {
  motionActivity *= 0.9;
  if (demoMode) updateDemoInput();
  else readCameraMotion();
  updateAudio();
  updateRipples();
  renderCameraRefraction();
  updateParticles();
  drawHud();
}

function mousePressed() {
  if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
    disturbRing(mouseX, mouseY, 18, 7);
    emitParticles(mouseX, mouseY, 18);
  }
}

function startCamera() {
  cam = createCapture({ video: { width: { ideal: 900 }, height: { ideal: 600 } }, audio: false });
  cam.hide();
}

function makeWaveGrid() {
  let grid = new Array(cols);
  for (let x = 0; x < cols; x++) {
    grid[x] = new Float32Array(rows);
  }
  return grid;
}

function resetRipples() {
  for (let x = 0; x < cols; x++) {
    prevWave[x].fill(0);
    curWave[x].fill(0);
  }
  motionTracks = [];
  demoPreviousPosition = null;
}

function rebaseMotionFrame() {
  if (!cam) return;
  cam.loadPixels();
  if (cam.pixels.length > 0) {
    prevFrame = new Uint8ClampedArray(cam.pixels);
    cameraReady = true;
  }
}

function readCameraMotion() {
  if (!cam) return;
  cam.loadPixels();
  if (cam.pixels.length === 0) {
    return;
  }

  if (!cameraReady || !prevFrame || prevFrame.length !== cam.pixels.length) {
    prevFrame = new Uint8ClampedArray(cam.pixels);
    cameraReady = true;
    return;
  }

  let activeBlocks = [];
  let blockRow = 0;
  for (let y = motionSearchRadius; y < cam.height - motionBlockSize - motionSearchRadius; y += motionBlockSize) {
    let blockCol = 0;
    for (let x = motionSearchRadius; x < cam.width - motionBlockSize - motionSearchRadius; x += motionBlockSize) {
      let motion = blockMotionAmount(x, y);
      if (motion > motionThreshold) {
        activeBlocks.push({ x, y, col: blockCol, row: blockRow, motion });
      }
      blockCol++;
    }
    blockRow++;
  }

  let regions = clusterMotionBlocks(activeBlocks);
  updateMotionRegions(regions);
  prevFrame.set(cam.pixels);
}

function clusterMotionBlocks(blocks) {
  let lookup = new Map();
  let visited = new Set();
  for (let block of blocks) lookup.set(block.col + "," + block.row, block);
  let regions = [];

  for (let seed of blocks) {
    let seedKey = seed.col + "," + seed.row;
    if (visited.has(seedKey)) continue;
    let queue = [seed];
    let members = [];
    visited.add(seedKey);

    while (queue.length > 0) {
      let block = queue.pop();
      members.push(block);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          let key = (block.col + dx) + "," + (block.row + dy);
          if (lookup.has(key) && !visited.has(key)) {
            visited.add(key);
            queue.push(lookup.get(key));
          }
        }
      }
    }

    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let strongest = members[0];
    for (let block of members) {
      totalWeight += block.motion;
      weightedX += (block.x + motionBlockSize * 0.5) * block.motion;
      weightedY += (block.y + motionBlockSize * 0.5) * block.motion;
      if (block.motion > strongest.motion) strongest = block;
    }
    let averageMotion = totalWeight / members.length;
    if (members.length >= 2 || averageMotion > motionThreshold * 1.75) {
      regions.push({
        blocks: members,
        centerX: weightedX / totalWeight,
        centerY: weightedY / totalWeight,
        averageMotion,
        strongest
      });
    }
  }

  regions.sort((a, b) => b.blocks.length * b.averageMotion - a.blocks.length * a.averageMotion);
  return regions.slice(0, 6);
}

function updateMotionRegions(regions) {
  let now = millis();
  let usedTracks = new Set();
  motionActivity = max(motionActivity, constrain(regions.length / 4, 0, 1));

  for (let region of regions) {
    let sx = map(cam.width - 1 - region.centerX, 0, cam.width - 1, 0, width);
    let sy = map(region.centerY, 0, cam.height - 1, 0, height);
    let bestTrack = null;
    let bestDistance = 140;

    for (let track of motionTracks) {
      if (usedTracks.has(track.id)) continue;
      let d = dist(track.x, track.y, sx, sy);
      if (d < bestDistance) {
        bestDistance = d;
        bestTrack = track;
      }
    }

    let flow = estimateBlockFlow(region.strongest.x, region.strongest.y);
    let flowX = -flow.x * width / cam.width;
    let flowY = flow.y * height / cam.height;
    if (!bestTrack) {
      bestTrack = {
        id: nextMotionTrackId++,
        x: sx - flowX,
        y: sy - flowY,
        vx: flowX,
        vy: flowY,
        lastSeen: now,
        lastImpulse: -Infinity
      };
      motionTracks.push(bestTrack);
    }

    usedTracks.add(bestTrack.id);
    let targetX = lerp(bestTrack.x, sx, 0.42);
    let targetY = lerp(bestTrack.y, sy, 0.42);
    let travel = dist(bestTrack.x, bestTrack.y, targetX, targetY);
    let observedVX = targetX - bestTrack.x + flowX * 1.35;
    let observedVY = targetY - bestTrack.y + flowY * 1.35;
    bestTrack.vx = lerp(bestTrack.vx, observedVX, 0.38);
    bestTrack.vy = lerp(bestTrack.vy, observedVY, 0.38);
    let flowSpeed = sqrt(bestTrack.vx * bestTrack.vx + bestTrack.vy * bestTrack.vy);
    let force = map(constrain(region.averageMotion, motionThreshold, 120), motionThreshold, 120, 2.2, 7.2);
    let trailWidth = constrain(sqrt(region.blocks.length) * 7, 10, 32);
    let trailLength = constrain(28 + flowSpeed * 7 + sqrt(region.blocks.length) * 3, 32, 135);

    if ((travel > 2.5 || flowSpeed > 3) && now - bestTrack.lastImpulse > 80) {
      disturbWake(targetX, targetY, bestTrack.vx, bestTrack.vy, force, trailWidth, trailLength);
      bestTrack.lastImpulse = now;
    }

    bestTrack.x = targetX;
    bestTrack.y = targetY;
    bestTrack.lastSeen = now;
  }

  motionTracks = motionTracks.filter(track => now - track.lastSeen < 450);
}

function blockMotionAmount(blockX, blockY) {
  let total = 0;
  let count = 0;

  for (let y = blockY; y < blockY + motionBlockSize; y += motionSampleStep) {
    for (let x = blockX; x < blockX + motionBlockSize; x += motionSampleStep) {
      let idx = 4 * (y * cam.width + x);
      total += colorDiff(cam.pixels, idx, prevFrame, idx);
      count++;
    }
  }

  return total / max(1, count);
}

function estimateBlockFlow(blockX, blockY) {
  let bestError = Infinity;
  let bestX = 0;
  let bestY = 0;

  for (let flowY = -motionSearchRadius; flowY <= motionSearchRadius; flowY += motionSearchRadius) {
    for (let flowX = -motionSearchRadius; flowX <= motionSearchRadius; flowX += motionSearchRadius) {
      let error = blockMatchError(blockX, blockY, flowX, flowY);
      if (error < bestError) {
        bestError = error;
        bestX = flowX;
        bestY = flowY;
      }
    }
  }

  return { x: bestX, y: bestY };
}

function blockMatchError(blockX, blockY, flowX, flowY) {
  let total = 0;
  let count = 0;

  for (let y = blockY; y < blockY + motionBlockSize; y += motionSampleStep) {
    for (let x = blockX; x < blockX + motionBlockSize; x += motionSampleStep) {
      let prevX = constrain(x - flowX, 0, cam.width - 1);
      let prevY = constrain(y - flowY, 0, cam.height - 1);
      let nowIdx = 4 * (y * cam.width + x);
      let prevIdx = 4 * (prevY * cam.width + prevX);
      total += colorDiff(cam.pixels, nowIdx, prevFrame, prevIdx);
      count++;
    }
  }

  return total / max(1, count);
}

function colorDiff(a, ai, b, bi) {
  return (
    abs(a[ai] - b[bi]) +
    abs(a[ai + 1] - b[bi + 1]) +
    abs(a[ai + 2] - b[bi + 2])
  ) / 3;
}

function updateRipples() {
  for (let x = 1; x < cols - 1; x++) {
    let left = prevWave[x - 1];
    let center = prevWave[x];
    let right = prevWave[x + 1];
    let target = curWave[x];
    for (let y = 1; y < rows - 1; y++) {
      let cardinal =
        left[y] +
        right[y] +
        center[y - 1] +
        center[y + 1];
      let diagonal =
        left[y - 1] +
        right[y - 1] +
        left[y + 1] +
        right[y + 1];
      target[y] = (cardinal * 0.4 + diagonal * 0.1 - target[y]) * damping * fadeRate;
    }
  }

  let temp = prevWave;
  prevWave = curWave;
  curWave = temp;
  fadeRipples();
}

function fadeRipples() {
  for (let x = 1; x < cols - 1; x++) {
    let current = curWave[x];
    for (let y = 1; y < rows - 1; y++) {
      current[y] *= fadeRate;
    }
  }
}

function renderCameraRefraction() {
  let sourcePixels;
  let sourceWidth;
  let sourceHeight;
  if (demoMode) {
    sourcePixels = demoLayer.pixels;
    sourceWidth = width;
    sourceHeight = height;
  } else if (cameraReady && cam && cam.pixels.length > 0) {
    sourcePixels = cam.pixels;
    sourceWidth = cam.width;
    sourceHeight = cam.height;
  } else {
    background(0);
    fill(230);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(18);
    text("正在等待摄像头权限…", width / 2, height / 2);
    fill(140, 180, 200);
    textSize(13);
    text("点击上方“演示模式”可以无传感器预览", width / 2, height / 2 + 30);
    return;
  }

  loadPixels();

  const renderStep = 2;
  for (let y = 0; y < height; y += renderStep) {
    let gy = min(rows - 2, max(1, (y / gridSize) | 0));
    for (let x = 0; x < width; x += renderStep) {
      let gx = min(cols - 2, max(1, (x / gridSize) | 0));

      let waveDx = prevWave[gx + 1][gy] - prevWave[gx - 1][gy];
      let waveDy = prevWave[gx][gy + 1] - prevWave[gx][gy - 1];
      let chroma = 1.5 + bassLevel * 7;
      let strength = refractionStrength + soundLevel * 15;
      let sampleX = min(width - 1, max(0, floor(x + waveDx * strength)));
      let sampleY = min(height - 1, max(0, floor(y + waveDy * refractionStrength)));
      let sourceX = demoMode ? sampleX : width - 1 - sampleX;
      let sx = floor(sourceX * sourceWidth / width);
      let sy = floor(sampleY * sourceHeight / height);
      let shift = floor(waveDx * chroma * sourceWidth / width);
      let redX = min(sourceWidth - 1, max(0, sx + shift));
      let blueX = min(sourceWidth - 1, max(0, sx - shift));
      let base = 4 * (sy * sourceWidth + sx);
      let red = 4 * (sy * sourceWidth + redX);
      let blue = 4 * (sy * sourceWidth + blueX);
      let shine = constrain((abs(waveDx) + abs(waveDy)) * 115, 0, 56);
      let rr = min(255, sourcePixels[red] + shine * 0.75);
      let gg = min(255, sourcePixels[base + 1] + shine);
      let bb = min(255, sourcePixels[blue + 2] + shine * 1.2);
      for (let oy = 0; oy < renderStep && y + oy < height; oy++) {
        for (let ox = 0; ox < renderStep && x + ox < width; ox++) {
          let idx = 4 * ((y + oy) * width + x + ox);
          pixels[idx] = rr;
          pixels[idx + 1] = gg;
          pixels[idx + 2] = bb;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  updatePixels();
}

function sampleInputSmooth(screenX, screenY, source, sourceWidth, sourceHeight, chromaShift) {
  let sx = map(width - 1 - screenX, 0, width - 1, 0, sourceWidth - 1);
  let sy = map(screenY, 0, height - 1, 0, sourceHeight - 1);
  sx = constrain(sx, 0, sourceWidth - 1);
  sy = constrain(sy, 0, sourceHeight - 1);
  let x0 = floor(sx);
  let y0 = floor(sy);
  let shiftedR = constrain(floor(x0 + chromaShift), 0, sourceWidth - 1);
  let shiftedB = constrain(floor(x0 - chromaShift), 0, sourceWidth - 1);
  let base = 4 * (y0 * sourceWidth + x0);
  let red = 4 * (y0 * sourceWidth + shiftedR);
  let blue = 4 * (y0 * sourceWidth + shiftedB);
  return [source[red], source[base + 1], source[blue + 2]];
}

function sampleCameraSmooth(screenX, screenY) {
  let sx = map(width - 1 - screenX, 0, width - 1, 0, cam.width - 1);
  let sy = map(screenY, 0, height - 1, 0, cam.height - 1);
  sx = constrain(sx, 0, cam.width - 1);
  sy = constrain(sy, 0, cam.height - 1);

  let x0 = floor(sx);
  let y0 = floor(sy);
  let x1 = min(x0 + 1, cam.width - 1);
  let y1 = min(y0 + 1, cam.height - 1);
  let tx = sx - x0;
  let ty = sy - y0;

  let c00 = cameraPixel(x0, y0);
  let c10 = cameraPixel(x1, y0);
  let c01 = cameraPixel(x0, y1);
  let c11 = cameraPixel(x1, y1);

  return [
    lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty),
    lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty),
    lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty)
  ];
}

function cameraPixel(x, y) {
  let idx = 4 * (y * cam.width + x);
  return [
    cam.pixels[idx],
    cam.pixels[idx + 1],
    cam.pixels[idx + 2]
  ];
}

function disturbCircle(mx, my, force, radius) {
  let gx = constrain(floor(mx / gridSize), 3, cols - 4);
  let gy = constrain(floor(my / gridSize), 3, rows - 4);

  for (let ix = gx - radius; ix <= gx + radius; ix++) {
    for (let iy = gy - radius; iy <= gy + radius; iy++) {
      let d = dist(ix, iy, gx, gy);
      let strength = max(0, radius * 0.62 - d) * force;
      if (ix > 1 && ix < cols - 2 && iy > 1 && iy < rows - 2) {
        prevWave[ix][iy] += strength;
      }
    }
  }
}

function disturbFan(mx, my, dirX, dirY, force) {
  let len = sqrt(dirX * dirX + dirY * dirY);
  if (len < 0.001) {
    disturbCircle(mx, my, force, 4);
    return;
  }

  let ux = dirX / len;
  let uy = dirY / len;
  let px = -uy;
  let py = ux;
  let baseRadius = 4;
  let fanLength = constrain(force * 3.1, 26, 86);
  let fanWidth = constrain(force * 1.35, 13, 44);

  for (let step = 0; step <= fanLength; step += gridSize * 2) {
    let t = step / fanLength;
    let cx = mx + ux * step;
    let cy = my + uy * step;
    let halfWidth = fanWidth * (0.25 + t * 0.95);
    let localForce = force * (1 - t * 0.72);

    for (let side = -halfWidth; side <= halfWidth; side += gridSize * 2) {
      let edgeFade = 1 - abs(side) / max(1, halfWidth);
      let wx = cx + px * side;
      let wy = cy + py * side;
      disturbCircle(wx, wy, localForce * edgeFade, baseRadius);
    }
  }
}

function disturbStroke(x1, y1, x2, y2, force, widthPixels) {
  let ax = x1 / gridSize;
  let ay = y1 / gridSize;
  let bx = x2 / gridSize;
  let by = y2 / gridSize;
  let radius = max(2, widthPixels / gridSize * 0.5);
  let minX = max(2, floor(min(ax, bx) - radius * 2.4));
  let maxX = min(cols - 3, ceil(max(ax, bx) + radius * 2.4));
  let minY = max(2, floor(min(ay, by) - radius * 2.4));
  let maxY = min(rows - 3, ceil(max(ay, by) + radius * 2.4));
  let vx = bx - ax;
  let vy = by - ay;
  let lengthSquared = vx * vx + vy * vy;
  let innerVariance = 2 * radius * radius;
  let outerRadius = radius * 2.15;
  let outerVariance = 2 * outerRadius * outerRadius;

  for (let gx = minX; gx <= maxX; gx++) {
    for (let gy = minY; gy <= maxY; gy++) {
      let t = lengthSquared > 0.001
        ? constrain(((gx - ax) * vx + (gy - ay) * vy) / lengthSquared, 0, 1)
        : 0;
      let nearestX = ax + vx * t;
      let nearestY = ay + vy * t;
      let dx = gx - nearestX;
      let dy = gy - nearestY;
      let distanceSquared = dx * dx + dy * dy;
      let ridge = exp(-distanceSquared / innerVariance);
      let balancingTrough = 0.32 * exp(-distanceSquared / outerVariance);
      let taper = 0.72 + 0.28 * t;
      prevWave[gx][gy] += force * (ridge - balancingTrough) * taper;
    }
  }
}

function disturbWake(headX, headY, velocityX, velocityY, force, widthPixels, lengthPixels) {
  let speed = sqrt(velocityX * velocityX + velocityY * velocityY);
  if (speed < 0.01) return;
  let ux = velocityX / speed;
  let uy = velocityY / speed;
  let px = -uy;
  let py = ux;
  let tailX = headX - ux * lengthPixels;
  let tailY = headY - uy * lengthPixels;
  let spread = lengthPixels * 0.24;

  disturbStroke(tailX, tailY, headX, headY, force * 0.72, widthPixels);
  disturbStroke(
    tailX + px * spread,
    tailY + py * spread,
    headX,
    headY,
    force * 0.42,
    widthPixels * 0.62
  );
  disturbStroke(
    tailX - px * spread,
    tailY - py * spread,
    headX,
    headY,
    force * 0.42,
    widthPixels * 0.62
  );
}

async function enableMicrophone() {
  try {
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    audioData = new Uint8Array(analyser.frequencyBinCount);
    audioContext.createMediaStreamSource(stream).connect(analyser);
    micState = "已连接";
    document.getElementById("mic-button").textContent = "麦克风已开启";
  } catch (error) {
    micState = "权限被拒绝";
    console.error("Microphone initialization failed:", error);
  }
}

function updateAudio() {
  let level = 0;
  let bass = 0;
  if (demoMode && !analyser) {
    level = 0.055 + 0.025 * sin(frameCount * 0.08);
    if (frameCount % 92 < 9) level += 0.22 * (1 - (frameCount % 92) / 9);
    bass = level * 1.2;
    micState = "演示信号";
  } else if (analyser) {
    analyser.getByteFrequencyData(audioData);
    let total = 0;
    let bassTotal = 0;
    for (let i = 0; i < audioData.length; i++) total += audioData[i];
    for (let i = 1; i < 14; i++) bassTotal += audioData[i];
    level = total / audioData.length / 255;
    bass = bassTotal / 13 / 255;
  }
  soundLevel = lerp(soundLevel, level, 0.28);
  bassLevel = lerp(bassLevel, bass, 0.3);
  if (soundLevel > 0.12 && millis() - lastSoundBurst > 170) {
    let x = width * (0.25 + 0.5 * noise(frameCount * 0.037));
    let y = height * (0.25 + 0.5 * noise(80 + frameCount * 0.031));
    disturbRing(x, y, 12 + bassLevel * 24, 5 + bassLevel * 7);
    emitParticles(x, y, 7 + floor(soundLevel * 25));
    lastSoundBurst = millis();
  }
}

function updateDemoInput() {
  let g = demoLayer;
  let t = frameCount * 0.02;
  g.background(7, 14, 28);
  for (let y = 0; y < height; y += 4) {
    let k = y / height;
    g.stroke(10 + 18 * k, 28 + 45 * k, 50 + 70 * k);
    g.line(0, y, width, y);
  }
  g.noStroke();
  g.fill(16, 160, 190, 65);
  g.ellipse(180 + 30 * sin(t), 205, 360, 360);
  g.fill(115, 48, 210, 55);
  g.ellipse(720, 420 + 30 * cos(t), 430, 430);
  let x = width * (0.5 + 0.31 * sin(frameCount * 0.035));
  let y = height * (0.52 + 0.18 * sin(frameCount * 0.0595));
  g.fill(245, 176, 78, 225);
  g.circle(x, y, 64);
  g.fill(236, 242, 255, 230);
  g.textAlign(CENTER, CENTER);
  g.textSize(30);
  g.text("CAMERA + SOUND", width / 2, 88);
  g.textSize(15);
  g.fill(178, 207, 230, 210);
  g.text("MULTIMODAL RIPPLE LAB / DEMO SIGNAL", width / 2, 122);
  g.loadPixels();
  if (frameCount % 4 === 0) {
    if (demoPreviousPosition) {
      let vx = x - demoPreviousPosition.x;
      let vy = y - demoPreviousPosition.y;
      let speed = sqrt(vx * vx + vy * vy);
      let length = constrain(48 + speed * 8, 48, 120);
      disturbWake(x, y, vx, vy, 4.8, 22, length);
    }
    demoPreviousPosition = { x, y };
    motionActivity = 0.82;
  }
}

function disturbRing(mx, my, force, radius) {
  let gx = constrain(floor(mx / gridSize), ceil(radius) + 2, cols - ceil(radius) - 3);
  let gy = constrain(floor(my / gridSize), ceil(radius) + 2, rows - ceil(radius) - 3);
  radius = ceil(radius);
  for (let x = gx - radius; x <= gx + radius; x++) {
    for (let y = gy - radius; y <= gy + radius; y++) {
      let d = dist(x, y, gx, gy);
      let ring = exp(-pow(d - radius * 0.65, 2) / max(1, radius * 0.45));
      prevWave[x][y] += force * ring;
    }
  }
}

function emitParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(0.8, 3.8) * (1 + bassLevel);
    particles.push({ x, y, vx: cos(angle) * speed, vy: sin(angle) * speed, life: 1, size: random(2, 6) });
  }
  if (particles.length > 240) particles.splice(0, particles.length - 240);
}

function updateParticles() {
  blendMode(ADD);
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= 0.018;
    fill(65, 205, 255, 180 * p.life);
    circle(p.x, p.y, p.size * p.life);
    if (p.life <= 0) particles.splice(i, 1);
  }
  blendMode(BLEND);
}

function drawHud() {
  noStroke();
  fill(4, 10, 20, 185);
  rect(18, 18, 255, 112, 12);
  fill(235);
  textAlign(LEFT, TOP);
  textSize(15);
  text("多模态涟漪实验", 34, 31);
  fill(145, 180, 205);
  textSize(11);
  text(demoMode ? "输入：演示信号" : "输入：摄像头 + 麦克风", 34, 56);
  drawMeter(34, 78, 96, motionActivity, color(34, 205, 210), "动作");
  drawMeter(153, 78, 96, constrain(soundLevel * 3, 0, 1), color(190, 90, 255), "声音");
  fill(145, 180, 205);
  text("麦克风：" + micState, 34, 108);
}

function drawMeter(x, y, w, value, c, label) {
  fill(255, 18);
  rect(x, y, w, 7, 4);
  fill(c);
  rect(x, y, w * value, 7, 4);
  fill(165, 195, 215);
  text(label, x, y + 11);
}

function toggleDemoMode() {
  demoMode = !demoMode;
  resetRipples();
  prevFrame = null;
  document.getElementById("demo-button").textContent = demoMode ? "使用摄像头" : "演示模式";
  if (!demoMode && !cam) startCamera();
}

function keyPressed() {
  if (key === "r" || key === "R") resetRipples();
  if (key === "d" || key === "D") toggleDemoMode();
  if (key === "m" || key === "M") enableMicrophone();
}
