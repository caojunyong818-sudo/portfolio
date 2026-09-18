/* DOM-first archive browsing. The Three.js layer is loaded only for archive view. */
const root = document.querySelector('[data-archive]');
if (root) {
  const en = document.documentElement.lang === 'en';
  const q = selector => root.querySelector(selector);
  const qa = selector => [...root.querySelectorAll(selector)];
  const panels = qa('[data-archive-project]');
  const projects = panels.map(panel => ({
    id: panel.dataset.archiveProject, category: panel.dataset.archiveCategory,
    code: panel.dataset.archiveCode, number: panel.dataset.archiveNumber,
    title: panel.querySelector('h2').textContent,
    image: panel.querySelector('img')?.src,
    panel, button: q(`[data-archive-select="${panel.dataset.archiveProject}"]`)
  }));
  const filters = qa('[data-archive-filter]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const host = q('[data-archive-scene]');
  const parameters = new URL(location.href).searchParams;
  let category = filters.some(f => f.dataset.archiveFilter === parameters.get('category')) ? parameters.get('category') : 'all';
  let visible = [], selected = parameters.get('project') || projects[0].id;
  let view = parameters.get('view') === 'grid' ? 'grid' : 'archive';
  let scene, scenePromise, panelAnimation;

  function saveUrl() {
    const url = new URL(location.href);
    category === 'all' ? url.searchParams.delete('category') : url.searchParams.set('category', category);
    url.searchParams.set('project', selected);
    view === 'grid' ? url.searchParams.set('view', view) : url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }
  function select(id, update = true) {
    if (!visible.some(p => p.id === id)) return;
    const changed = selected !== id;
    selected = id;
    const project = projects.find(p => p.id === selected);
    panelAnimation?.cancel();
    projects.forEach(p => {
      p.panel.hidden = p.id !== selected;
      p.button.setAttribute('aria-pressed', String(p.id === selected));
    });
    if (changed && !reduce.matches && view === 'archive') {
      panelAnimation = project.panel.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:340,easing:'cubic-bezier(.2,.75,.2,1)'});
    }
    q('[data-archive-active]').textContent = project.number;
    q('[data-archive-position]').textContent = `${String(visible.findIndex(p => p.id === id) + 1).padStart(2,'0')} / ${String(visible.length).padStart(2,'0')}`;
    q('[data-archive-announcement]').textContent = `${project.number} / ${project.title}`;
    q('[data-archive-prev]').disabled = q('[data-archive-next]').disabled = visible.length < 2;
    root.dataset.selectedProject = id;
    if (view === 'archive') {
      const index = q('.archive-index'), button = project.button;
      if (button.offsetLeft < index.scrollLeft || button.offsetLeft + button.offsetWidth > index.scrollLeft + index.clientWidth)
        index.scrollTo({left:button.offsetLeft - (index.clientWidth - button.offsetWidth)/2,behavior:reduce.matches?'instant':'smooth'});
    }
    scene?.select(id);
    if (update) saveUrl();
  }
  function filter(next, update = true) {
    category = filters.some(f => f.dataset.archiveFilter === next) ? next : 'all';
    visible = projects.filter(p => category === 'all' || p.category === category);
    filters.forEach(f => f.setAttribute('aria-pressed', String(f.dataset.archiveFilter === category)));
    projects.forEach(p => { p.button.hidden = !visible.includes(p); });
    qa('.archive-grid [data-category]').forEach(card => { card.hidden = category !== 'all' && card.dataset.category !== category; });
    q('[data-archive-count]').textContent = `${visible.length} / ${projects.length} ${en ? 'projects' : '个项目'}`;
    scene?.filter(visible.map(p => p.id));
    select(visible.some(p => p.id === selected) ? selected : visible[0].id, update);
  }
  function move(delta) {
    const i = visible.findIndex(p => p.id === selected);
    select(visible[(i + delta + visible.length) % visible.length].id);
  }
  function open() { projects.find(p => p.id === selected).panel.querySelector('.dossier-open').click(); }
  function noScene() {
    host.dataset.ready = 'false';
    host.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
    scene?.setVisible(false);
    q('[data-archive-hint]').textContent = en ? 'Choose a project from the index below' : '使用下方目录选择作品';
  }
  async function loadScene() {
    if (!scenePromise) scenePromise = import('./archive-scene.js?v=20260919-wave-3').then(({createArchiveScene}) => {
      scene = createArchiveScene(host, projects, {onSelect:select,onStep:move,onOpen:open,onFailure:noScene});
      scene.filter(visible.map(p => p.id));
      scene.select(selected);
      scene.setVisible(view === 'archive');
      return scene;
    }).catch(error => { noScene(); console.warn('Archive preview unavailable:', error.message); });
    return scenePromise;
  }
  function setView(next, update = true) {
    view = next === 'grid' ? 'grid' : 'archive';
    q('.archive-interface').hidden = view !== 'archive';
    q('.archive-grid').hidden = view !== 'grid';
    qa('[data-archive-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.archiveView === view)));
    root.dataset.archiveView = view;
    document.body.classList.toggle('archive-immersive', view === 'archive');
    scene?.setVisible(view === 'archive');
    if (view === 'archive') loadScene();
    if (update) saveUrl();
  }
  filters.forEach(b => b.addEventListener('click', () => filter(b.dataset.archiveFilter)));
  projects.forEach(p => p.button.addEventListener('click', () => select(p.id)));
  qa('[data-archive-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.archiveView)));
  q('[data-archive-prev]').addEventListener('click', () => move(-1));
  q('[data-archive-next]').addEventListener('click', () => move(1));
  host.addEventListener('keydown', e => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const actions = {ArrowLeft:()=>move(-1),ArrowRight:()=>move(1),Home:()=>select(visible[0].id),End:()=>select(visible.at(-1).id),Enter:open};
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
  });
  reduce.addEventListener('change', () => panelAnimation?.cancel());
  q('.archive-view-switch').hidden = false;
  filter(category, false);
  setView(view, false);
}
