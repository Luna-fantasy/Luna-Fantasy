import Link from 'next/link';

interface Props {
    tabLabel: string;
    reason?: string | null;
}

export default function TabClosedNotice({ tabLabel, reason }: Props) {
    return (
        <main className="tab-closed-notice">
            <div className="tab-closed-card">
                <div className="tab-closed-glow" aria-hidden="true" />
                <div className="tab-closed-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <h1 className="tab-closed-title">Temporarily Unavailable</h1>
                <p className="tab-closed-sub">
                    <strong>{tabLabel}</strong> is currently closed for maintenance.
                </p>
                {reason && (
                    <p className="tab-closed-reason">{reason}</p>
                )}
                <p className="tab-closed-back">
                    <Link href="/">Return home</Link>
                </p>
            </div>
            <style>{`
                .tab-closed-notice {
                    min-height: calc(100vh - 80px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 24px;
                }
                .tab-closed-card {
                    position: relative;
                    max-width: 520px;
                    width: 100%;
                    text-align: center;
                    background: linear-gradient(180deg, rgba(20, 24, 48, 0.85) 0%, rgba(10, 12, 28, 0.95) 100%);
                    border: 1px solid rgba(140, 200, 255, 0.18);
                    border-radius: 20px;
                    padding: 56px 36px;
                    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(140, 200, 255, 0.04) inset;
                    overflow: hidden;
                }
                .tab-closed-glow {
                    position: absolute;
                    top: -120px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 280px;
                    height: 280px;
                    background: radial-gradient(circle, rgba(80, 180, 255, 0.18) 0%, transparent 70%);
                    pointer-events: none;
                }
                .tab-closed-icon {
                    color: #6fb6ff;
                    margin-bottom: 20px;
                    display: inline-flex;
                    padding: 18px;
                    border-radius: 18px;
                    background: rgba(80, 180, 255, 0.08);
                    border: 1px solid rgba(80, 180, 255, 0.22);
                }
                .tab-closed-title {
                    font-family: 'Cinzel', serif;
                    font-size: 28px;
                    font-weight: 700;
                    margin: 0 0 12px;
                    color: #f1f5ff;
                    letter-spacing: 0.02em;
                }
                .tab-closed-sub {
                    color: #b9c4e0;
                    font-size: 16px;
                    margin: 0 0 18px;
                    line-height: 1.55;
                }
                .tab-closed-reason {
                    color: #88a0c8;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0 0 24px;
                    padding: 14px 16px;
                    border-radius: 10px;
                    background: rgba(140, 200, 255, 0.05);
                    border-left: 3px solid #6fb6ff;
                    text-align: left;
                }
                .tab-closed-back {
                    margin: 28px 0 0;
                    font-size: 14px;
                }
                .tab-closed-back a {
                    color: #6fb6ff;
                    text-decoration: none;
                    border-bottom: 1px solid rgba(111, 182, 255, 0.4);
                    padding-bottom: 1px;
                    transition: color 0.2s;
                }
                .tab-closed-back a:hover {
                    color: #a4d2ff;
                }
            `}</style>
        </main>
    );
}
