// The approved editorial-motion.js scroll scores for the market and treasury.
const scores = {
  hub: [['.merchant-card', 'crossing', 'stall']],
  kael: [['.luckbox-card', 'coffer-leaf', 'coffer']],
  zoldar: [['.ticket-card', 'ticket-leaf', 'ticket']],
  brimor: [['.brimor-card', 'dyed-leaf', 'role']],
  mells: [['.mells-card', 'frame-leaf', 'frame']],
  meluna: [['.vendor-header,.gem-box-card,.drop-rate-item', 'cabochon']],
  seluna: [['.seluna-status-banner', 'inscription', 'moon']],
  bank: [
    ['.bank-section-header', 'treasury-line'],
    ['.salary-card,.service-card,.loan-tier', 'account-leaf'],
    ['.loan-image-container', 'illustration'],
  ],
};
const properties = ['--beat', '--bias', '--unveil', '--transit', '--folio-pos', '--folio-x'];
const clamp = number => Math.max(0, Math.min(1, number));

export function mountEconomyCards(root, scene) {
  const groups = scores[scene];
  if (!root || !groups || !window.IntersectionObserver) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const visible = new Set();
  const marked = new Set();
  const query = groups.map(([selector]) => selector).join(',');
  let observer, frame = 0;

  function draw() {
    frame = 0;
    if (document.hidden || reduced.matches) return;
    const height = innerHeight;
    for (const element of visible) {
      const box = element.getBoundingClientRect();
      if (element.dataset.cadence && box.top < height + 45 && box.bottom > -45) {
        const span = Math.max(height * .5, Math.min(box.height, height));
        const position = clamp((height - box.top) / (height + span));
        element.style.setProperty('--folio-pos', position.toFixed(3));
        element.style.setProperty('--folio-x', (position * 100).toFixed(1) + '%');
      }
      const reveal = clamp((height - box.top) / (height * .35));
      const eased = reveal * reveal * (3 - 2 * reveal);
      element.style.setProperty('--unveil', (1 - eased).toFixed(3));
      element.style.setProperty('--transit', clamp((height * .78 - box.top) / (height + Math.min(box.height, height) * .8)).toFixed(3));
    }
  }
  function schedule() {
    if (!frame && visible.size && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function reset() {
    observer?.disconnect();
    visible.clear();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    delete root.dataset.economyCards;
    for (const element of marked) {
      delete element.dataset.score;
      delete element.dataset.cadence;
      for (const property of properties) element.style.removeProperty(property);
    }
    marked.clear();
  }
  function scan() {
    reset();
    if (reduced.matches || document.hidden) return;
    const direction = document.documentElement.dir === 'rtl' ? -1 : 1;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      schedule();
    }, {rootMargin: '80px 0px'});
    for (const [selector, score, cadence] of groups) {
      root.querySelectorAll(selector).forEach((element, index) => {
        element.dataset.score = score;
        if (cadence) element.dataset.cadence = cadence;
        element.style.setProperty('--beat', String(index % 3));
        element.style.setProperty('--bias', String((index % 2 === 0 ? 1 : -1) * direction));
        marked.add(element);
        observer.observe(element);
      });
    }
    root.dataset.economyCards = 'active';
  }
  // Native shop inventory and bank account sections can arrive after the hero.
  const updates = new MutationObserver(changes => {
    if (reduced.matches || document.hidden) return;
    const changed = changes.some(change => {
      const target = change.target;
      // React can reuse the loading div for the loaded merchant status banner.
      if (target.nodeType === 1 && target.matches(query) !== marked.has(target)) return true;
      return [...change.addedNodes, ...change.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches(query) || node.querySelector(query))
      );
    });
    if (changed) scan();
  });
  updates.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  const opts = {signal: events.signal};
  window.addEventListener('scroll', schedule, {...opts, passive: true});
  window.addEventListener('resize', schedule, {...opts, passive: true});
  window.addEventListener('pagehide', reset, opts);
  window.addEventListener('pageshow', scan, opts);
  document.addEventListener('visibilitychange', scan, opts);
  reduced.addEventListener('change', scan, opts);
  scan();
  return () => { events.abort(); updates.disconnect(); reset(); };
}
