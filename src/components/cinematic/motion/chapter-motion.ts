import { createFrameClock, perFrame } from '@/lib/cinematic/getlayers-frame';
// The visible interval follows Textura / GetLayers' use-progress-trigger
// (top bottom -> bottom top). Each Luna surface renders its own moving part.
const surfaces: Record<string, [
    string,
    string
]> = {
    '': ['.showcase-row .media-frame', 'exhibit'],
    bazaar: ['.merchant-card', 'awning'],
    bank: ['.salary-card,.loan-tier,.service-card', 'mint'],
    trading: ['.trading-signed-out,.trading-stats-bar', 'balance'],
    partners: ['.pa6-plaque', 'links'],
    members: ['.member-card,.members-search', 'constellation'],
    characters: ['.faction-header,.c7-archive-title', 'aperture'],
    story: ['.chron-chapter,.chapter-label,.chapter-number', 'chronicle'],
    about: ['.about-quote,.about-stat', 'orbits'],
    faq: ['details.faq-item', 'bookmark'],
    contact: ['.contact-field', 'seal'],
    terms: ['.legal-content', 'margin'],
    privacy: ['.legal-content', 'shutter'],
    refund: ['.legal-content', 'return'],
    'auth/signin': ['.auth-card', 'keyhole'],
};
const merchants: Record<string, string> = { kael: 'dealer', meluna: 'facets', zoldar: 'forge', seluna: 'tide', brimor: 'binding', mells: 'weave' };
const gameKinds: Record<string, string> = { 'luna-fantasy': 'fan', 'grand-fantasy': 'folio', 'faction-war': 'ranks' };
export function mountChapterMotion(root: Element, pathname: string) {
    const slug = pathname.split('/').filter(Boolean).slice(1).join('/');
    const shop = slug.startsWith('bazaar/') ? merchants[slug.split('/')[1]] : undefined;
    const game = gameKinds[slug];
    const entry = game ? ['.archive-deck', game] : shop ? ['.cinematic-economy-hero,.shop-hero,.merchant-hero,.bazaar-hero,.luckbox-card,.gem-box-card,.brimor-card,.mells-card,.ticket-card', shop] : surfaces[slug];
    if (!entry)
        return () => { };
    const shell = root as HTMLElement;
    shell.dataset.editionRoute = slug || 'home';
    const [selector, kind] = entry, motion = matchMedia('(prefers-reduced-motion: reduce)'), events = new AbortController();
    const mounted = new Set<HTMLElement>(), visible = new Set<HTMLElement>();
    const clock = createFrameClock();
    let frame = 0, active: HTMLElement | null = null, aim = .5, light = .5;
    function draw(time: number) {
        frame = 0;
        if (motion.matches || document.hidden)
            return;
        const { dt } = clock.tick(time);
        light += (aim - light) * perFrame(.17, dt);
        for (const node of Array.from(visible)) {
            const box = node.getBoundingClientRect(), start = box.top - innerHeight, end = box.bottom;
            const length = Math.max(1, Math.abs(start - end));
            const phase = Math.min(Math.max(0, 1 - (start + length) / length), 1);
            node.style.setProperty('--edition-phase', phase.toFixed(3));
            node.style.setProperty('--edition-light', ((node === active ? light : phase) * 100).toFixed(1) + '%');
        }
        if (active && Math.abs(aim - light) > .002)
            schedule();
        else
            clock.reset();
    }
    function schedule() { if (!frame && !motion.matches && !document.hidden)
        frame = requestAnimationFrame(draw); }
    const io = new IntersectionObserver(entries => { for (const e of entries) {
        const n = e.target as HTMLElement;
        if (e.isIntersecting)
            visible.add(n);
        else
            visible.delete(n);
    } schedule(); });
    function attach(node: HTMLElement) {
        if (mounted.has(node) || node.tagName === 'INPUT')
            return;
        mounted.add(node);
        node.dataset.editionMotion = kind;
        if (getComputedStyle(node).position === 'static')
            node.dataset.editionBase = '';
        // Records and artwork remain real DOM. This layer draws only their marginal ornament.
        const foil = document.createElement('span');
        foil.className = 'edition-foil';
        foil.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++)
            foil.appendChild(document.createElement('i'));
        node.appendChild(foil);
        io.observe(node);
    }
    function discover(container: Element) { if (container instanceof HTMLElement && container.matches(selector))
        attach(container); container.querySelectorAll<HTMLElement>(selector).forEach(attach); }
    discover(root);
    const mo = new MutationObserver(entries => { for (const change of entries)
        for (const n of Array.from(change.addedNodes))
            if (n instanceof Element && !n.closest('.edition-foil'))
                discover(n); });
    mo.observe(root, { childList: true, subtree: true });
    function focus(event: Event) {
        const el = event.target;
        if (!(el instanceof Element))
            return;
        const node = el.closest<HTMLElement>('[data-edition-motion]');
        if (active && active !== node)
            delete active.dataset.editionLit;
        active = node;
        if (!node)
            return;
        const box = node.getBoundingClientRect();
        aim = event instanceof PointerEvent ? Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width))) : .55;
        node.dataset.editionLit = 'true';
        schedule();
    }
    function clear() { if (active)
        delete active.dataset.editionLit; active = null; aim = .5; schedule(); }
    const opts = { signal: events.signal, passive: true };
    root.addEventListener('pointermove', focus, opts);
    root.addEventListener('pointerdown', focus, opts);
    root.addEventListener('focusin', focus, opts);
    root.addEventListener('pointerleave', clear, opts);
    root.addEventListener('focusout', clear, opts);
    window.addEventListener('scroll', schedule, opts);
    window.addEventListener('resize', schedule, opts);
    motion.addEventListener('change', clear, opts);
    return () => { delete shell.dataset.editionRoute; events.abort(); io.disconnect(); mo.disconnect(); cancelAnimationFrame(frame); for (const node of Array.from(mounted)) {
        delete node.dataset.editionMotion;
        delete node.dataset.editionBase;
        delete node.dataset.editionLit;
        node.style.removeProperty('--edition-phase');
        node.style.removeProperty('--edition-light');
        node.querySelector(':scope>.edition-foil')?.remove();
    } };
}
