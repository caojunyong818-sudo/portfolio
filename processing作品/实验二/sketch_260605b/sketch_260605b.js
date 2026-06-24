/******************
Enhanced vector-field particle experiment, adapted from Vamoss:
https://www.openprocessing.org/sketch/751983
******************/

const particles = [];
const MAX_PARTICLES = 2200;
const FIELD_DURATION = 7000;
const BACKGROUND = [7, 9, 28];
const fieldNames = [
  "正弦漂流", "交织波", "乘积涟漪", "经纬波", "抛物风", "对数纹理",
  "切线脉冲", "环形轨道", "双轨系统", "摆线漩涡", "阻尼吸引子", "镜像波",
  "星云双涡旋", "呼吸网格"
];
const palettes = [
  ["#63F3FF", "#5B8CFF", "#A86BFF", "#FF5FD2", "#FFE66D"],
  ["#FF4D6D", "#FF8FA3", "#FFC2D1", "#FFE5EC", "#FFB703"],
  ["#80FFDB", "#72EFDD", "#64DFDF", "#5390D9", "#6930C3"]
];

let colors = [];
let fieldIndex = 12;
let paletteIndex = 0;
let lastFieldChange = 0;
let xScale, yScale, centerX, centerY;
let paused = false;
let showHelp = true;
let pressX = 0;
let pressY = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(window.devicePixelRatio || 1, 2));
  strokeCap(ROUND);
  textFont("Arial");
  updateCanvasMetrics();
  applyPalette();
  background(...BACKGROUND);
  seedComposition(720);
}

function draw() {
  blendMode(BLEND);
  noStroke();
  fill(...BACKGROUND, paused ? 16 : 25);
  rect(0, 0, width, height);

  if (!paused) {
    const now = millis();
    if (now - lastFieldChange > FIELD_DURATION) {
      fieldIndex = (fieldIndex + 1) % fieldNames.length;
      lastFieldChange = now;
      emitBurst(centerX, centerY, 180);
    }
    emitAmbientParticles();
    if (mouseIsPressed && mouseY > 74) emitBurst(mouseX, mouseY, 16);
    updateParticles();
  }
  drawInterface();
}

function emitAmbientParticles() {
  const t = millis() * 0.00035;
  const radius = min(width, height) * (0.16 + 0.05 * sin(t * 1.7));
  emitBurst(centerX + cos(t * 3.1) * radius * 1.7, centerY + sin(t * 2.3) * radius, 5);
}

function seedComposition(count) {
  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const radius = pow(random(), 0.65) * min(width, height) * 0.42;
    createParticle(centerX + cos(angle) * radius, centerY + sin(angle) * radius);
  }
}

function emitBurst(px, py, count) {
  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const radius = randomGaussian(0, count > 50 ? 52 : 20);
    createParticle(px + cos(angle) * radius, py + sin(angle) * radius);
  }
}

function createParticle(px, py) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push({
    x: getXPos(px), y: getYPos(py), lastX: px, lastY: py,
    size: random(0.55, 2.8), color: random(colors),
    direction: random() > 0.24 ? 1 : -1,
    speed: random(0.65, 1.35), age: 0, life: random(260, 680)
  });
}

function updateParticles() {
  const stepSize = min(deltaTime, 34) * 0.00165;
  blendMode(ADD);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    let vx = getSlopeX(p.x, p.y);
    let vy = getSlopeY(p.x, p.y);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
      particles.splice(i, 1);
      continue;
    }
    const magnitude = max(1, sqrt(vx * vx + vy * vy) / 7);
    vx /= magnitude;
    vy /= magnitude;
    p.x += p.direction * vx * stepSize * p.speed;
    p.y += p.direction * vy * stepSize * p.speed;
    p.age++;
    const px = getXPrint(p.x);
    const py = getYPrint(p.y);
    const alpha = 210 * sin(PI * constrain(p.age / p.life, 0, 1));
    stroke(red(p.color), green(p.color), blue(p.color), alpha);
    strokeWeight(p.size * (0.75 + alpha / 420));
    line(px, py, p.lastX, p.lastY);
    p.lastX = px;
    p.lastY = py;
    const border = 160;
    if (p.age > p.life || px < -border || py < -border || px > width + border || py > height + border) {
      particles.splice(i, 1);
    }
  }
  blendMode(BLEND);
}

function getSlopeY(x, y) {
  switch (fieldIndex) {
    case 0: return sin(x);
    case 1: return sin(x * 5) * y * 0.3;
    case 2: return cos(x * y);
    case 3: return sin(x) * cos(y);
    case 4: return cos(x) * y * y;
    case 5: return log(max(abs(x), 0.001)) * log(max(abs(y), 0.001));
    case 6: return tan(constrain(x, -1.45, 1.45)) * cos(y);
    case 7: return -sin(x * 0.1) * 3;
    case 8: return (x - x * x * x) * 0.01;
    case 9: return -sin(x);
    case 10: return -y - sin(1.5 * x) + 0.7;
    case 11: return sin(x) * cos(y);
    case 12: {
      const left = vortex(x + 3.2, y, -1);
      const right = vortex(x - 3.2, y, 1);
      return left.y + right.y + sin(x * 0.7 + millis() * 0.0005) * 0.35;
    }
    case 13: return sin(x * 1.25 + millis() * 0.0007) * cos(y * 0.7) + x * 0.035;
  }
}

function getSlopeX(x, y) {
  switch (fieldIndex) {
    case 0: return cos(y);
    case 1: return cos(y * 5) * x * 0.3;
    case 2:
    case 3:
    case 4:
    case 5:
    case 6: return 1;
    case 7: return sin(y * 0.1) * 3;
    case 8: return y / 3;
    case 9: return -y;
    case 10: return -1.5 * y;
    case 11: return sin(y) * cos(x);
    case 12: {
      const left = vortex(x + 3.2, y, -1);
      const right = vortex(x - 3.2, y, 1);
      return left.x + right.x + cos(y * 0.55) * 0.3;
    }
    case 13: return cos(y * 1.1 - millis() * 0.0008) * sin(x * 0.65) - y * 0.035;
  }
}

function vortex(x, y, spin) {
  const distanceSq = x * x + y * y + 0.8;
  return {
    x: spin * (-y / distanceSq) * 10 - x * 0.025,
    y: spin * (x / distanceSq) * 10 - y * 0.025
  };
}

function drawInterface() {
  noStroke();
  fill(3, 5, 18, 174);
  rect(18, 18, min(510, width - 36), showHelp ? 106 : 58, 14);
  fill(255, 238);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(17);
  text(`VECTOR BLOOM  ·  ${nf(fieldIndex + 1, 2)}/${fieldNames.length}  ${fieldNames[fieldIndex]}`, 34, 32);
  textStyle(NORMAL);
  fill(184, 207, 255, 220);
  textSize(12);
  text(`${particles.length} 粒子  ·  ${paused ? "已暂停" : "自动演化"}`, 34, 58);
  if (showHelp) {
    fill(255, 190);
    text("拖动绘制  ·  点击切换场  ·  P 换色  ·  空格暂停  ·  C 清屏  ·  S 保存", 34, 84);
  }
}

function mousePressed() {
  pressX = mouseX;
  pressY = mouseY;
}

function mouseReleased() {
  if (mouseY <= 74) {
    showHelp = !showHelp;
  } else if (dist(mouseX, mouseY, pressX, pressY) < 8) {
    nextField();
  }
}

function keyPressed() {
  if (key === " ") paused = !paused;
  if (key === "c" || key === "C") {
    particles.length = 0;
    background(...BACKGROUND);
  }
  if (key === "p" || key === "P") {
    paletteIndex = (paletteIndex + 1) % palettes.length;
    applyPalette();
    emitBurst(centerX, centerY, 260);
  }
  if (key === "s" || key === "S") saveCanvas("vector-bloom", "png");
  if (keyCode === RIGHT_ARROW) nextField();
  if (keyCode === LEFT_ARROW) {
    fieldIndex = (fieldIndex - 1 + fieldNames.length) % fieldNames.length;
    lastFieldChange = millis();
  }
}

function nextField() {
  fieldIndex = (fieldIndex + 1) % fieldNames.length;
  lastFieldChange = millis();
  emitBurst(mouseX, mouseY, 220);
}

function applyPalette() {
  colors = palettes[paletteIndex].map((hex) => color(hex));
}

function updateCanvasMetrics() {
  centerX = width / 2;
  centerY = height / 2;
  xScale = min(width, height) / 19;
  yScale = xScale;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateCanvasMetrics();
  background(...BACKGROUND);
  particles.length = 0;
  seedComposition(620);
}

function getXPos(x) { return (x - centerX) / xScale; }
function getYPos(y) { return (y - centerY) / yScale; }
function getXPrint(x) { return xScale * x + centerX; }
function getYPrint(y) { return yScale * y + centerY; }
