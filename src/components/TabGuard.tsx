import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isMastermind } from '@/lib/admin/auth';
import { getSiteTabs, invalidateCache, type TabKey } from '@/lib/admin/site-tabs';

interface Props {
    tabKey: TabKey;
    children: ReactNode;
}

/**
 * Maps each child tab to its parent group key. Closing a parent group
 * cascades to its children — so closing "games" auto-closes Luna Fantasy,
 * Grand Fantasy, and Faction War even though they each have their own
 * tabKey. Without this, you'd see the parent vanish from the navbar but
 * /faction-war would still respond 200 to direct URL access.
 */
const PARENT_GROUP: Partial<Record<TabKey, TabKey>> = {
    'luna-fantasy': 'games',
    'grand-fantasy': 'games',
    'faction-war': 'games',
    'story': 'world',
    'characters': 'world',
    'partners': 'world',
    'members': 'world',
    'bank': 'economy',
    'bazaar': 'economy',
    'trading': 'economy',
    'marketplace': 'economy',
};

/**
 * Server-side guard for closeable public pages. Behaviour by viewer:
 *
 *   - tab open                 → render the page
 *   - tab closed + Mastermind  → render with a "viewing as Mastermind" banner
 *   - tab closed + anyone else → server-side redirect to "/"
 *
 * The redirect is the load-bearing part. A maintenance message at the
 * original URL still returns 200 OK + page content, which leaks that the
 * route exists and lets anyone with the link "see the page". `redirect()`
 * from a server component issues a 307 *before* any HTML is sent, so the
 * URL becomes fully inaccessible — there is no "closed" page to look at.
 */
export default async function TabGuard({ tabKey, children }: Props) {
    // Force a fresh DB read on every guarded request. The 30s TTL inside
    // getSiteTabs() is fine for navbar polling but a security boundary like
    // "is this page closed?" must reflect the *current* state — there must
    // be no window where a public visitor can hit a freshly-closed URL and
    // still see content because the cache is stale.
    invalidateCache();
    const tabs = await getSiteTabs();
    const own = tabs[tabKey];
    const parentKey = PARENT_GROUP[tabKey];
    const parent = parentKey ? tabs[parentKey] : null;

    const closed = !!(own?.closed) || !!(parent?.closed);
    if (!closed) return <>{children}</>;

    // Pick the most specific reason: own > parent. Used in the banner.
    const state = (own?.closed ? own : parent)!;

    const session = await auth();
    const viewerIsMastermind = isMastermind(session?.user?.discordId);

    if (!viewerIsMastermind) {
        // Hard block. No message, no leakage — the URL just sends them home.
        redirect('/');
    }

    return (
        <>
            <div className="tab-mastermind-banner">
                <span className="tab-mastermind-banner-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </span>
                <span>
                    Closed to public — public visitors are redirected to home. You see this because you're a Mastermind.
                    {state.reason && <em> Reason: {state.reason}</em>}
                </span>
                <a href="/admin/site-tabs" className="tab-mastermind-banner-link">Manage</a>
            </div>
            {children}
            <style>{`
                .tab-mastermind-banner {
                    position: sticky;
                    top: 80px;
                    z-index: 50;
                    margin: 0 auto;
                    max-width: 1100px;
                    background: linear-gradient(90deg, rgba(120, 80, 200, 0.92), rgba(80, 120, 220, 0.92));
                    color: #fff;
                    padding: 10px 18px;
                    border-radius: 0 0 12px 12px;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 8px 28px rgba(120, 80, 200, 0.35);
                }
                .tab-mastermind-banner em { font-style: normal; opacity: 0.85; margin-left: 6px; }
                .tab-mastermind-banner-icon { display: inline-flex; }
                .tab-mastermind-banner-link {
                    margin-left: auto;
                    color: #fff;
                    text-decoration: underline;
                    font-weight: 600;
                }
            `}</style>
        </>
    );
}
