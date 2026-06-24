let video;
let lineSpacing = 4;
let squiggleStrength = 3;
let lineWeight = 1;

let lineSpacingSlider, squiggleSlider, weightSlider;
let layoutDiv, canvasParent, guiDiv;

function setup() {
    // Layout container with custom class
    layoutDiv = createDiv();
    layoutDiv.class('layout-container');
    layoutDiv.style('background-color', '#2d3748'); // gray-800
    layoutDiv.style('border-radius', '1rem'); // rounded-2xl
    layoutDiv.style('box-shadow', '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'); // shadow-2xl

    // Canvas container
    canvasParent = createDiv();
    canvasParent.parent(layoutDiv);
    canvasParent.class('p5-canvas-container'); // your existing CSS class for canvas styling

    let cnv = createCanvas(640, 480);
    cnv.parent(canvasParent);

    // Webcam setup
    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide();

    frameRate(10);
    noFill();

    // GUI container on right
    guiDiv = createDiv();
    guiDiv.parent(layoutDiv);
    guiDiv.class('gui-container');

    // Label styles
    const labelClass = 'slider-label';

    // Line Spacing Slider
    let lineSpacingLabel = createP('Line Spacing');
    lineSpacingLabel.class(labelClass);
    lineSpacingLabel.parent(guiDiv);

    lineSpacingSlider = createSlider(1, 20, lineSpacing, 1);
    lineSpacingSlider.class('slider-full-width');
    lineSpacingSlider.parent(guiDiv);

    // Squiggle Strength Slider
    let squiggleLabel = createP('Squiggle Strength');
    squiggleLabel.class('slider-full-width');
    squiggleLabel.parent(guiDiv);

    squiggleSlider = createSlider(0, 10, squiggleStrength, 0.1);
    squiggleSlider.class('slider-full-width');
    squiggleSlider.parent(guiDiv);

    // Line Thickness Slider
    let weightLabel = createP('Line Thickness');
    weightLabel.class(labelClass);
    weightLabel.parent(guiDiv);

    weightSlider = createSlider(0.5, 5, lineWeight, 0.1);
    weightSlider.class('slider-full-width');
    weightSlider.parent(guiDiv);
}

function draw() {
    background(0);
    stroke(255);

    video.loadPixels();
    background(0,15); // 拖影残影，模拟示波器余晖

    lineSpacing = lineSpacingSlider.value();
    squiggleStrength = squiggleSlider.value();
    lineWeight = weightSlider.value();
    strokeWeight(lineWeight);

    const numLines = int(height / lineSpacing);

    for (let i = 0; i < numLines; i++) {
        const yBase = i * lineSpacing;
        drawSquigglyLine(yBase, i);
    }
}

function drawSquigglyLine(yBase, lineIndex) {

    // 红
    stroke(255, 0, 0, 120);
    drawChannel(yBase, lineIndex, -1);

    // 绿
    stroke(0, 255, 0, 120);
    drawChannel(yBase, lineIndex, 0);

    // 蓝
    stroke(0, 0, 255, 120);
    drawChannel(yBase, lineIndex, 1);
}
function drawChannel(yBase, lineIndex, channelOffset) {

    beginShape();

    for (let x = 0; x <= width; x += 2) {

        const mirrorX = video.width - x - 1;
        const imgX = constrain(mirrorX, 0, video.width - 1);
        const imgY = constrain(yBase, 0, video.height - 1);

        const index = (imgY * video.width + imgX) * 4;

        const r = video.pixels[index];
        const g = video.pixels[index + 1];
        const b = video.pixels[index + 2];

        const bright = (r + g + b) / 3;

        // 基础位移
        let y = yBase + map(bright, 1, 255, -15, 15);

        // Noise 扰动
        let n = noise(
            x * 0.1,
            lineIndex * 0.1,
            frameCount * 0.05
        );

        let squiggle = map(
            n,
            0,
            1,
            -squiggleStrength,
            squiggleStrength
        );

        y += squiggle;

        // 位移幅度
        let motionAmount = abs(squiggle)*1.5;

        let rgbShift = map(
            motionAmount,
            0,
            squiggleStrength,
            4,
            8
        );

        let offsetX = channelOffset * rgbShift;

        vertex(x + offsetX, y);
    }

    endShape();
}
   
