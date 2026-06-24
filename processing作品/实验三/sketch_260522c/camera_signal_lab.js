const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
let video, demoSource, cameraTimer;
let useDemo = new URLSearchParams(window.location.search).get('demo') === '1';
let cameraReady = false;
let sourceStatus, fpsStatus, modeSelect;
let spacingSlider, strengthSlider, weightSlider, trailSlider;
let spacingValue, strengthValue, weightValue, trailValue;

function setup() {
  pixelDensity(1);
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  canvas.parent('canvas-shell');
  frameRate(30);
  noFill();
  strokeJoin(ROUND);
  strokeCap(ROUND);
  demoSource = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  demoSource.pixelDensity(1);
  createControls();
  startCamera();
}

function startCamera() {
  if (useDemo) {
    setSourceStatus('演示图像', 'demo');
    return;
  }
  setSourceStatus('正在请求摄像头…', 'waiting');
  try {
    video = createCapture({ video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, audio: false }, () => {
      cameraReady = true;
      clearTimeout(cameraTimer);
      setSourceStatus('摄像头已连接', 'camera');
    });
    video.size(CANVAS_WIDTH, CANVAS_HEIGHT);
    video.hide();
    video.elt.setAttribute('playsinline', '');
    video.elt.addEventListener('error', activateDemoSource);
    cameraTimer = setTimeout(() => { if (!cameraReady) activateDemoSource(); }, 5000);
  } catch (error) {
    console.error('摄像头初始化失败：', error);
    activateDemoSource();
  }
}

function activateDemoSource() {
  useDemo = true;
  setSourceStatus('摄像头不可用，已切换演示图像', 'demo');
}

function createControls() {
  sourceStatus = select('#source-status');
  fpsStatus = select('#fps-status');
  modeSelect = select('#effect-mode');
  const requestedMode = new URLSearchParams(window.location.search).get('effect');
  if (['rgb', 'neon', 'contour'].includes(requestedMode)) modeSelect.value(requestedMode);
  spacingSlider = select('#line-spacing');
  strengthSlider = select('#squiggle-strength');
  weightSlider = select('#line-weight');
  trailSlider = select('#trail-strength');
  spacingValue = select('#line-spacing-value');
  strengthValue = select('#squiggle-value');
  weightValue = select('#line-weight-value');
  trailValue = select('#trail-value');
  [spacingSlider, strengthSlider, weightSlider, trailSlider]
    .forEach((control) => control.input(updateControlLabels));
  updateControlLabels();
  select('#demo-button').mousePressed(() => {
    useDemo = !useDemo;
    setSourceStatus(useDemo ? '演示图像' : '摄像头输入', useDemo ? 'demo' : 'camera');
  });
  select('#save-button').mousePressed(() => saveCanvas('camera_art_' + modeSelect.value(), 'png'));
}

function updateControlLabels() {
  spacingValue.html(spacingSlider.value() + ' px');
  strengthValue.html(Number(strengthSlider.value()).toFixed(1));
  weightValue.html(Number(weightSlider.value()).toFixed(1) + ' px');
  trailValue.html(trailSlider.value() + ' / 255');
}

function setSourceStatus(message, state) {
  if (!sourceStatus) return;
  sourceStatus.html(message);
  sourceStatus.attribute('data-state', state);
}

function draw() {
  background(4, 7, 15, 255 - Number(trailSlider.value()));
  const source = getSourceFrame();
  if (!source) {
    drawWaitingState();
    return;
  }
  source.loadPixels();
  if (!source.pixels || source.pixels.length < CANVAS_WIDTH * CANVAS_HEIGHT * 4) return;

  const spacing = Number(spacingSlider.value());
  const strength = Number(strengthSlider.value());
  const lineWeight = Number(weightSlider.value());
  const sampleStep = spacing <= 5 ? 4 : 3;
  const mode = modeSelect.value();
  blendMode(ADD);
  for (let y = 0, lineIndex = 0; y < height; y += spacing, lineIndex += 1) {
    const points = sampleLine(source, y, lineIndex, sampleStep, strength);
    if (mode === 'rgb') drawRgbLine(points, lineWeight, strength);
    else if (mode === 'neon') drawNeonLine(points, lineWeight);
    else drawContourLine(points, lineWeight);
  }
  blendMode(BLEND);
  if (frameCount % 10 === 0) fpsStatus.html(nf(frameRate(), 2, 1) + ' FPS · 步长 ' + sampleStep + ' px');
}

function getSourceFrame() {
  if (useDemo) {
    updateDemoSource();
    return demoSource;
  }
  if (video && video.elt.readyState >= 2 && video.width > 0) return video;
  return null;
}

function updateDemoSource() {
  const g = demoSource;
  const t = frameCount * 0.025;
  g.background(8, 12, 28);
  g.noStroke();
  for (let y = 0; y < height; y += 8) {
    const mix = y / height;
    g.fill(10 + 18 * mix, 18 + 25 * mix, 42 + 45 * mix);
    g.rect(0, y, width, 8);
  }
  g.fill(255, 78, 135);
  g.circle(width * 0.32 + sin(t) * 45, height * 0.42, 190);
  g.fill(30, 210, 255);
  g.circle(width * 0.66 + cos(t * 0.8) * 55, height * 0.54, 230);
  g.fill(255, 205, 70);
  g.rect(width * 0.42, height * 0.22 + sin(t * 1.4) * 25, 135, 135, 24);
  g.fill(245);
  g.textAlign(CENTER, CENTER);
  g.textStyle(BOLD);
  g.textSize(44);
  g.text('CAMERA / SIGNAL', width / 2, height * 0.76);
}

function sampleLine(source, yBase, lineIndex, step, strength) {
  const points = [];
  const sourceY = constrain(floor(yBase * source.height / height), 0, source.height - 1);
  for (let x = 0; x <= width; x += step) {
    const sourceX = constrain(floor((width - x - 1) * source.width / width), 0, source.width - 1);
    const index = (sourceY * source.width + sourceX) * 4;
    const r = source.pixels[index] || 0;
    const g = source.pixels[index + 1] || 0;
    const b = source.pixels[index + 2] || 0;
    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
    const wave = map(brightness, 0, 255, 18, -18);
    const jitter = map(noise(x * 0.012, lineIndex * 0.12, frameCount * 0.018), 0, 1, -strength, strength);
    points.push({ x, y: yBase + wave + jitter, brightness });
  }
  return points;
}

function drawRgbLine(points, lineWeight, strength) {
  const shift = 3 + strength * 0.55;
  drawPolyline(points, -shift, [255, 45, 95, 145], lineWeight);
  drawPolyline(points, 0, [35, 255, 185, 145], lineWeight);
  drawPolyline(points, shift, [55, 125, 255, 145], lineWeight);
}

function drawNeonLine(points, lineWeight) {
  drawPolyline(points, 0, [40, 100, 255, 35], lineWeight * 5);
  drawPolyline(points, 0, [25, 220, 255, 95], lineWeight * 2.4);
  drawPolyline(points, 0, [245, 250, 255, 220], max(0.7, lineWeight * 0.65));
}

function drawContourLine(points, lineWeight) {
  const palette = [[122, 92, 255], [20, 225, 210], [255, 209, 70], [255, 91, 145], [235, 245, 255]];
  strokeWeight(lineWeight * 1.15);
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    const meanBrightness = (previous.brightness + point.brightness) * 0.5;
    const colorValue = palette[floor(meanBrightness / 52) % 5];
    stroke(colorValue[0], colorValue[1], colorValue[2], 175);
    line(previous.x, previous.y, point.x, point.y);
  }
}

function drawPolyline(points, offsetX, rgba, weight) {
  noFill();
  stroke(rgba[0], rgba[1], rgba[2], rgba[3]);
  strokeWeight(weight);
  beginShape();
  for (const point of points) curveVertex(point.x + offsetX, point.y);
  endShape();
}

function drawWaitingState() {
  push();
  fill(220);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(16);
  text('等待摄像头授权…', width / 2, height / 2);
  pop();
}
