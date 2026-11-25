'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
type Chapter = {
    node: HTMLElement;
    title: string;
};
export function ChapterIndex({ locale }: {
    locale: string;
}) {
    const pathname = usePathname(), root = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]), [open, setOpen] = useState(false);
    const [current, setCurrent] = useState(0), [hidden, setHidden] = useState(false);
    const ar = locale === 'ar';
    useEffect(() => {
        setOpen(false);
        let rows: Chapter[] = [], frame = 0, timer = 0;
        function update() {
            frame = 0;
            let index = 0;
            for (let i = 0; i < rows.length; i++)
                if (rows[i].node.getBoundingClientRect().top <= innerHeight * .4)
                    index = i;
            setCurrent(index);
            const max = document.documentElement.scrollHeight - innerHeight;
            root.current?.style.setProperty('--chapter-arc', (max ? Math.min(1, Math.max(0, scrollY / max)) * 360 : 0).toFixed(1) + 'deg');
        }
        function queue() { if (!frame)
            frame = requestAnimationFrame(update); }
        function collect() {
            const main = document.querySelector('main') || document.querySelector('[data-luna-shell]');
            if (!main) {
                rows = [];
                setChapters([]);
                return;
            }
            const seen = new Set<string>();
            rows = Array.from(main.querySelectorAll<HTMLElement>('h1,h2,.faq-list h3,.legal-content h3')).filter(node => {
                if (!node.getClientRects().length || node.closest('[role="dialog"],dialog,nav,footer,article,[hidden],[aria-hidden="true"]'))
                    return false;
                const title = node.textContent?.trim();
                if (!title || title.length > 82 || seen.has(title))
                    return false;
                seen.add(title);
                return true;
            }).slice(0, 12).map(node => ({ node, title: node.textContent!.trim() }));
            setChapters(prev => prev.length === rows.length && prev.every((c, i) => c.node === rows[i].node && c.title === rows[i].title) ? prev : rows);
            setHidden(!!Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"],dialog[open],.mobile-menu.open,.mobile-menu.is-open')).find(n => n.getClientRects().length));
            queue();
        }
        function schedule() { clearTimeout(timer); timer = window.setTimeout(collect, 130); }
        collect();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', schedule);
        return () => { observer.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame); window.removeEventListener('scroll', queue); window.removeEventListener('resize', schedule); };
    }, [pathname]);
    useEffect(() => {
        if (!open)
            return;
        function out(e: PointerEvent) { if (e.target instanceof Node && !root.current?.contains(e.target))
            setOpen(false); }
        function esc(e: globalThis.KeyboardEvent) { if (e.key === 'Escape') {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
        } }
        document.addEventListener('pointerdown', out);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
    }, [open]);
    if (chapters.length < 2 || hidden)
        return null;
    return <nav ref={root} className="chapter-index" data-open={open} aria-label={ar ? 'أقسام الصفحة' : 'Page chapters'}>
    <button ref={trigger} type="button" className="chapter-trigger" aria-expanded={open} aria-controls="luna-chapter-list" onClick={() => setOpen(!open)}>
      <i aria-hidden="true"><b /></i><span>{ar ? 'أقسام الصفحة' : 'Chapters'}</span>
    </button>
    {open && <div className="chapter-sheet" id="luna-chapter-list"><div className="chapter-engraving" aria-hidden="true"/><ol>{chapters.map((c, i) => <li key={i}>
      <button type="button" aria-current={current === i ? 'location' : undefined} onClick={() => {
                    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
                    setOpen(false);
                    if (!c.node.hasAttribute('tabindex'))
                        c.node.tabIndex = -1;
                    c.node.focus({ preventScroll: true });
                    const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('scroll-padding-top')) || 86;
                    scrollTo({ top: c.node.getBoundingClientRect().top + scrollY - inset, behavior: reduced ? 'instant' : 'smooth' });
                }}>{c.title}</button></li>)}</ol></div>}
  </nav>;
}
