(() => {
  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-category]')];
  const count = document.querySelector('[data-result-count]');
  const motion = window.PortfolioMotion;
  let filterVersion = 0;
  let filterAnimations = [];
  const grid = document.querySelector('.works-list .project-grid');
  async function filterProjects(value, updateUrl = false) {
    const version = ++filterVersion;
    filterAnimations.forEach(animation => animation?.cancel());
    filterAnimations = [];
    const chosen = filters.some(button => button.dataset.filter === value) ? value : 'all';
    const previous = filters.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.filter;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === chosen)));
    const useMotion = updateUrl && previous !== chosen && motion?.enabled();
    const before = new Map(cards.filter(card => !card.hidden).map(card => [card, card.getBoundingClientRect()]));
    const oldHeight = grid?.getBoundingClientRect().height;
    if (useMotion) {
      cards.forEach(card => card.getAnimations().forEach(animation => animation.cancel()));
      filterAnimations = cards.filter(card => !card.hidden && chosen !== 'all' && card.dataset.category !== chosen).map(card => motion.animate(card,
        [{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-6px)'}], {duration:110}));
      await Promise.all(filterAnimations.filter(Boolean).map(animation => animation.finished.catch(() => {})));
      if (version !== filterVersion) return;
    }
    cards.forEach(card => {
      card.hidden = chosen !== 'all' && card.dataset.category !== chosen;
      if (updateUrl && !card.hidden) card.dataset.motionRevealed = 'true';
    });
    if (count) count.textContent = `${cards.filter(card => !card.hidden).length} / ${cards.length} ${document.documentElement.lang === 'en' ? 'projects' : '个项目'}`;
    if (updateUrl) {
      const url = new URL(location.href);
      if (chosen === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', chosen);
      history.replaceState(null, '', url);
    }
    if (useMotion) {
      const afterHeight = grid?.getBoundingClientRect().height;
      const visibleCards = cards.filter(card => !card.hidden);
      const after = new Map(visibleCards.map(card => [card, card.getBoundingClientRect()]));
      if (grid && oldHeight !== afterHeight) filterAnimations.push(motion.animate(grid,
        [{height:`${oldHeight}px`},{height:`${afterHeight}px`}], {duration:360}));
      visibleCards.forEach((card, index) => {
        const from = before.get(card), to = after.get(card);
        filterAnimations.push(motion.animate(card, [
          {opacity:from ? 1 : 0, transform:`translate(${from ? from.left-to.left : 0}px,${from ? from.top-to.top : 16}px)`},
          {opacity:1,transform:'translate(0,0)'}
        ], {duration:360,delay:Math.min(index,4)*35}));
      });
    }
  }
  if (filters.length) {
    filterProjects(new URL(location.href).searchParams.get('category') || 'all');
    filters.forEach(button => button.addEventListener('click', () => filterProjects(button.dataset.filter, true)));
  }
  const links = [...document.querySelectorAll('a[data-gallery]')];
  const dialog = document.querySelector('.lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    const image = dialog.querySelector('img');
    const caption = dialog.querySelector('figcaption');
    const counter = dialog.querySelector('[data-image-counter]');
    const original = dialog.querySelector('[data-image-original]');
    let index = 0;
    let imageAnimation;
    image.addEventListener('load', () => {
      imageAnimation?.cancel();
      if (dialog.open) imageAnimation = motion?.animate(image,
        [{opacity:.25,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}], {duration:260});
    });
    function show(next) {
      index = (next + links.length) % links.length;
      image.src = links[index].href;
      image.alt = links[index].dataset.caption;
      caption.textContent = image.alt;
      counter.textContent = `${index + 1} / ${links.length}`;
      original.href = image.src;
    }
    links.forEach((link, n) => link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); show(n); dialog.showModal(); document.body.classList.add('viewing-image');
    }));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-prev]').addEventListener('click', () => show(index - 1));
    dialog.querySelector('[data-next]').addEventListener('click', () => show(index + 1));
    dialog.addEventListener('close', () => { document.body.classList.remove('viewing-image'); image.removeAttribute('src'); });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });
  }
  document.querySelectorAll('.video-list details').forEach(details => details.addEventListener('toggle', () => {
    if (!details.open) details.querySelector('video')?.pause();
  }));
})();
