import { ReactNode } from 'react';
import { auth } from '@/auth';
import { isMastermind } from '@/lib/admin/auth';
import { getSiteTabs, TAB_LABELS, type TabKey } from '@/lib/admin/site-tabs';
import TabClosedNotice from './TabClosedNotice';

interface Props {
    tabKey: TabKey;
    children: ReactNode;
}

export default async function TabGuard({ tabKey, children }: Props) {
    const tabs = await getSiteTabs();
    const state = tabs[tabKey];
    if (!state?.closed) return <>{children}</>;

    const session = await auth();
    const viewerIsMastermind = isMastermind(session?.user?.discordId);

    if (viewerIsMastermind) {
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
                        Closed to public — viewing as Mastermind.
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

    return <TabClosedNotice tabLabel={TAB_LABELS[tabKey]} reason={state.reason} />;
}
