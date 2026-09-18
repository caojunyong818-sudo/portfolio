/* Short page handoffs and staggered entrances; ordinary links remain the fallback. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'portfolio-page-handoff';
  const active = new Set();
  let pending = '', leaveTimer = 0, recoveryTimer = 0, arrivalTimer = 0;
  let arrival = false;
  try {
    const record = JSON.parse(sessionStorage.getItem(key) || 'null');
    sessionStorage.removeItem(key);
    arrival = record?.url === location.href && Date.now() - record.time < 5000;
  } catch (_) {}
  if (!reduce.matches) root.classList.add('motion-ready');
  if (arrival && !reduce.matches) {
    root.classList.add('motion-arrive');
    // A CSS animation also uncovers the page if startup is interrupted.
    arrivalTimer = setTimeout(() => root.classList.remove('motion-arrive'), 650);
  }

  function animate(element, frames, options = {}) {
    if (reduce.matches || !element?.animate) return null;
    const animation = element.animate(frames, {
      duration: 480, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards', ...options
    });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  window.PortfolioMotion = { animate, enabled: () => !reduce.matches };

  function reset() {
    clearTimeout(leaveTimer); clearTimeout(recoveryTimer); clearTimeout(arrivalTimer);
    pending = '';
    root.classList.remove('motion-leave', 'motion-arrive');
    active.forEach(animation => animation.cancel()); active.clear();
  }
  function navigate() {
    if (!pending) return;
    const url = pending;
    try { sessionStorage.setItem(key, JSON.stringify({url, time:Date.now()})); } catch (_) {}
    location.assign(url);
    // Recover from a cancelled navigation instead of leaving an opaque cover.
    recoveryTimer = setTimeout(reset, 1200);
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduce.matches) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.matches('[data-gallery], [data-no-transition]')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !['http:', 'https:', 'file:'].includes(destination.protocol)) return;
    // Only the generated portfolio pages participate, never experiments or files.
    let path;
    try { path = decodeURIComponent(destination.pathname); } catch (_) { return; }
    if (!/\/个人简历\/(?:en\/)?(?:My|works_portfolio|about_profile|experience_profile|projects\/[a-z0-9-]+)\.html$/.test(path)) return;
    if (destination.pathname === location.pathname && destination.search === location.search) return;
    event.preventDefault();
    if (pending) return;
    pending = destination.href;
    root.classList.remove('motion-arrive');
    root.classList.add('motion-leave');
    leaveTimer = setTimeout(navigate, 180);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const first = [...document.querySelectorAll('.hero-copy > *, .particle-stage, .page-heading > *, .case-heading > *, .case-cover, .profile .hero-grid > *')];
    const initialDelay = arrival ? 90 : 0;
    first.forEach((element, index) => {
      // A chapter deep-link must not replay the hero above the current position.
      const box = element.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= innerHeight) return;
      const media = element.matches('.particle-stage,.case-cover,.portrait-card');
      animate(element, media ? [
        {opacity:0, transform:'translateX(26px)', clipPath:'inset(0 0 0 8%)'},
        {opacity:1, transform:'translateX(0)', clipPath:'inset(0 0 0 0)'}
      ] : [{opacity:0, transform:'translateY(16px)'}, {opacity:1, transform:'translateY(0)'}], {
        duration:media ? 620 : 480, delay:initialDelay + Math.min(index,4) * 45
      });
    });
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      let index = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (entry.target.dataset.motionRevealed) return;
        entry.target.dataset.motionRevealed = 'true';
        animate(entry.target, [{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}], {duration:520,delay:Math.min(index++,2)*55});
      });
    }, {threshold:.08});
    document.querySelectorAll('.section-head,.featured-copy,.feature,.project-card,.practice-list article,.gallery figure,.profile .section,.case-next').forEach(element => observer.observe(element));
    // Hash navigation stays native; a brief heading cue clarifies the destination.
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('.case-nav a[href]');
      if (!link) return;
      const url = new URL(link.href);
      let target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) { return; }
      const heading = target?.querySelector('h2');
      animate(heading, [{opacity:.45,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}], {duration:360,delay:100});
    });
  });
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  window.addEventListener('pagehide', () => { clearTimeout(recoveryTimer); });
  reduce.addEventListener('change', event => {
    const destination = pending;
    reset();
    root.classList.toggle('motion-ready', !event.matches);
    if (destination) location.assign(destination);
  });
})();
