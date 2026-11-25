const headingSelector = [
  '[data-luna-home] .showcase-title',
  '[data-luna-home] .section-title',
  '.c7-archive-title',
  '.merchants-section .section-title',
  '.bank-section > h2',
  '.partners-section .section-title',
  '.faq-header h1',
  '.contact-header h1',
].join(',');

export function mountRoseDetails(root: Element) {
  const headings = Array.from(root.querySelectorAll<HTMLElement>(headingSelector));
  const observe = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const heading = entry.target as HTMLElement;
      heading.dataset.roseIn = '';
      observe.unobserve(heading);
    }
  }, { threshold: 0.32 });
  for (const heading of headings) {
    heading.dataset.roseHeading = getComputedStyle(heading).textAlign === 'center' ? 'center' : 'start';
    observe.observe(heading);
  }

  const nav = root.querySelector<HTMLElement>('.topbar .navbar-island .nav');
  const marker = nav?.querySelector<HTMLElement>('.luna-nav-index');
  const events = new AbortController();
  const options = { signal: events.signal };
  const links = '.nav-link:not(.nav-link-closed),.games-dropdown-trigger';
  let selected: HTMLElement | null = null;

  function position(link: HTMLElement | null) {
    selected = link;
    if (!nav || !marker) return;
    if (!link || !nav.clientWidth) {
      delete marker.dataset.ready;
      return;
    }
    const box = link.getBoundingClientRect();
    const width = Math.min(65, Math.max(20, box.width * 0.64));
    const left = box.left - nav.getBoundingClientRect().left + (box.width - width) / 2;
    marker.style.setProperty('--index-left', left.toFixed(2) + 'px');
    marker.style.setProperty('--index-width', width.toFixed(2) + 'px');
    marker.dataset.ready = '';
  }
  function rest() {
    position(nav?.querySelector<HTMLElement>('.nav-link.active,.games-dropdown-trigger.active') ?? null);
  }
  function follow(event: Event) {
    const link = event.target instanceof Element ? event.target.closest<HTMLElement>(links) : null;
    if (link && nav?.contains(link) && link !== selected) position(link);
  }
  const resize = new ResizeObserver(() => selected ? position(selected) : rest());
  if (nav && marker) {
    resize.observe(nav);
    rest();
    nav.addEventListener('pointerover', follow, options);
    nav.addEventListener('pointerleave', rest, options);
    nav.addEventListener('focusin', follow, options);
    nav.addEventListener('focusout', event => {
      if (!(event.relatedTarget instanceof Node) || !nav.contains(event.relatedTarget)) rest();
    }, options);
    void document.fonts.ready.then(() => {
      if (!events.signal.aborted) selected ? position(selected) : rest();
    });
  }
  return () => {
    observe.disconnect();
    resize.disconnect();
    events.abort();
    if (marker) delete marker.dataset.ready;
    for (const heading of headings) {
      delete heading.dataset.roseHeading;
      delete heading.dataset.roseIn;
    }
  };
}
