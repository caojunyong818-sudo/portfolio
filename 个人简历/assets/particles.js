/* A dependency-free, Processing-inspired point sculpture. */
(() => {
  const stage = document.querySelector('[data-particle-stage]');
  const canvas = stage?.querySelector('canvas');
  const button = stage?.querySelector('[data-motion-toggle]');
  if (!canvas || !button) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) { button.hidden = true; return; }
  button.hidden = false;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  try { if (localStorage.getItem('portfolio-motion') === 'paused') paused = true; } catch (_) {}
  let visible = true, frame = 0, last = 0, time = 0;
  let width = 1, height = 1, points = [], pulse = -1;
  const pointer = { x: -1000, y: -1000, tiltX: 0, tiltY: 0, targetX: 0, targetY: 0 };
  const en = document.documentElement.lang === 'en';

  function updateButton() {
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? (en ? 'RESUME MOTION' : '继续动效') : (en ? 'PAUSE MOTION' : '暂停动效');
    stage.dataset.motion = paused ? 'paused' : 'playing';
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const mobile = width < 480;
    const ratio = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Twisted concentric loops give the sculpture a recognizable silhouette.
    const rows = mobile ? 30 : 44, columns = mobile ? 40 : 56;
    points = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u = column / columns * Math.PI * 2;
        const v = row / rows * Math.PI * 2;
        const r = 1.24 + .39 * Math.cos(v) + .16 * Math.cos(u * 3 + v * 2);
        points.push({ x: r * Math.cos(u), y: r * Math.sin(u), z: .48 * Math.sin(v) + .29 * Math.sin(u * 3),
          green: (column + row * 3) % 19 === 0, row, column });
      }
    }
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const cx = width * .52, cy = height * .48;
    const scale = Math.min(width * .255, height * .35);
    const ax = .9 + pointer.tiltY, ay = -.5 + time * .12 + pointer.tiltX;
    const az = -.45 + Math.sin(time * .13) * .12;
    const sx = Math.sin(ax), cxr = Math.cos(ax), sy = Math.sin(ay), cyr = Math.cos(ay);
    const sz = Math.sin(az), cz = Math.cos(az);
    // Quiet guide marks stay behind the point cloud.
    context.strokeStyle = 'rgba(47,58,32,.16)';
    context.lineWidth = .7;
    context.beginPath();
    context.ellipse(cx, cy, scale * 1.8, scale * 1.8, 0, 0, Math.PI * 2);
    context.moveTo(cx - scale * 2, cy); context.lineTo(cx + scale * 2, cy);
    context.moveTo(cx, cy - scale * 1.95); context.lineTo(cx, cy + scale * 1.95);
    context.stroke();

    const projected = points.map(p => {
      const breathing = 1 + .035 * Math.sin(time * .7 + p.column * .17);
      const y1 = p.y * cxr - p.z * sx, z1 = p.y * sx + p.z * cxr;
      const x2 = p.x * cyr + z1 * sy, z2 = -p.x * sy + z1 * cyr;
      const x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;
      const perspective = 4.8 / (4.8 - z2);
      let x = cx + x3 * scale * perspective * breathing;
      let y = cy + y3 * scale * perspective * breathing;
      const dx = x - pointer.x, dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (!paused && distance < 95 && distance > .1) {
        const force = (1 - distance / 95) ** 2 * 30;
        x += dx / distance * force; y += dy / distance * force;
      }
      return { x, y, z: z2, size: Math.max(.65, perspective * (width < 480 ? .9 : 1.15)), green: p.green };
    }).sort((a, b) => a.z - b.z);

    for (const p of projected) {
      const alpha = Math.max(.18, Math.min(.95, .57 + p.z * .2));
      context.fillStyle = p.green ? `rgba(73,98,0,${alpha})` : `rgba(22,27,18,${alpha})`;
      context.fillRect(p.x, p.y, p.size * 1.3, p.size * 1.3);
    }
    if (pulse >= 0) {
      context.strokeStyle = `rgba(42,58,18,${Math.max(0, .4 - pulse * .35)})`;
      context.beginPath(); context.arc(pointer.x, pointer.y, 20 + pulse * 150, 0, Math.PI * 2); context.stroke();
    }
    stage.dataset.ready = 'true';
  }

  function tick(timestamp) {
    frame = 0;
    if (paused || !visible || document.hidden) { last = 0; return; }
    // Cap the drawing rate at 30 fps; time-based movement remains consistent.
    if (!last || timestamp - last >= 1000 / 30) {
      const delta = last ? Math.min((timestamp - last) / 1000, .08) : 0;
      last = timestamp; time += delta;
      pointer.tiltX += (pointer.targetX - pointer.tiltX) * .075;
      pointer.tiltY += (pointer.targetY - pointer.tiltY) * .075;
      if (pulse >= 0) { pulse += delta; if (pulse > 1.15) pulse = -1; }
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    updateButton();
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  button.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('portfolio-motion', paused ? 'paused' : 'playing'); } catch (_) {}
    sync();
  });
  reduced.addEventListener('change', event => { paused = event.matches; sync(); draw(); });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || paused) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top;
    pointer.targetX = (pointer.x / width - .5) * .65;
    pointer.targetY = (pointer.y / height - .5) * .45;
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -1000; pointer.targetX = pointer.targetY = 0;
  });
  canvas.addEventListener('pointerdown', event => {
    if (paused) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pulse = 0;
  }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, {threshold:0}).observe(stage);
  new ResizeObserver(resize).observe(stage);
  resize(); sync();
})();
