(() => {
  const root = document.documentElement;
  const current = root.lang === 'en' ? 'en' : 'zh';
  const url = new URL(location.href);
  const requested = url.searchParams.get('lang');
  let saved;
  try { saved = localStorage.getItem('portfolio-language'); } catch (_) {}
  const explicit = requested === 'en' || requested === 'zh';
  // History restores the visited language instead of redirecting back to the
  // preference just written by the language switch.
  const returning = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  const desired = explicit ? requested : (returning || current === 'en' ? current : saved || current);
  if (explicit) {
    try { localStorage.setItem('portfolio-language', desired); } catch (_) {}
  }
  if (desired !== current && root.dataset.languageAlternate) {
    const next = new URL(root.dataset.languageAlternate, location.href);
    next.search = url.search;
    next.searchParams.set('lang', desired);
    next.hash = url.hash;
    location.replace(next.href);
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    // Make generated-page links language-explicit so history does not depend on
    // a preference changed on a later page (including hosts without bfcache).
    document.querySelectorAll('a[href]:not([data-language-switch])').forEach(link => {
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || link.getAttribute('href').startsWith('#')) return;
      let path;
      try { path = decodeURIComponent(destination.pathname); } catch (_) { return; }
      if (!/\/个人简历\/(?:en\/)?(?:My|works_portfolio|about_profile|experience_profile|projects\/[a-z0-9-]+)\.html$/.test(path)) return;
      destination.searchParams.set('lang', current);
      link.href = destination.href;
    });
    const toggle = document.querySelector('[data-language-switch]');
    if (!toggle) return;
    const next = new URL(toggle.href);
    const targetLanguage = toggle.dataset.languageSwitch;
    next.search = url.search;
    next.searchParams.set('lang', targetLanguage);
    next.hash = location.hash;
    toggle.href = next.href;
    toggle.addEventListener('click', () => {
      // Read the current filter/hash at click time, after any interactions.
      const destination = new URL(toggle.href);
      destination.search = location.search;
      destination.searchParams.set('lang', targetLanguage);
      destination.hash = location.hash;
      toggle.href = destination.href;
      try { localStorage.setItem('portfolio-language', targetLanguage); } catch (_) {}
    });
  });
})();
