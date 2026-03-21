'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminUserProfile } from '@/types/admin';
import ConfirmModal from '../../components/ConfirmModal';
import BalanceModifier from './components/BalanceModifier';
import LevelModifier from './components/LevelModifier';
import TicketsModifier from './components/TicketsModifier';
import CardManager from './components/CardManager';
import StoneManager from './components/StoneManager';
import InventoryManager from './components/InventoryManager';
import UserOverview from './components/UserOverview';
import { getTransactionTypeInfo } from '@/lib/admin/transaction-types';

const tabs = ['Overview', 'Cards', 'Stones', 'Inventory', 'Level Rewards', 'Transactions', 'Actions'] as const;
type Tab = typeof tabs[number];

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const discordId = params.discordId as string;

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [copied, setCopied] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${discordId}`);
      if (res.status === 404) { setError('User not found'); setLoading(false); return; }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      setError('Failed to load user profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [discordId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        Loading user profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-icon">!</div>
        <p>{error || 'User not found'}</p>
        <button className="admin-btn admin-btn-ghost admin-mt-16" onClick={() => router.push('/admin/users')}>
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header admin-user-header">
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => router.push('/admin/users')}>
          &larr;
        </button>
        <div className="admin-user-avatar">
          {profile.image ? (
            <img src={profile.image} alt="" />
          ) : (
            <span className="admin-user-avatar-initial">
              {(profile.globalName || profile.username || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="admin-user-meta">
          <h1 className="admin-page-title">
            <span className="emoji-float">👤</span> {profile.globalName || profile.username || 'Unknown User'}
          </h1>
          <p className="admin-page-subtitle admin-subtitle-mono">
            <button
              className={`admin-copy-btn ${copied ? 'admin-copy-btn-copied' : ''}`}
              onClick={() => {
                navigator.clipboard.writeText(discordId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              data-tooltip="Click to copy"
            >
              {copied ? 'Copied!' : discordId}
            </button>
            {profile.username && profile.globalName && profile.username !== profile.globalName && (
              <span className="admin-user-username">@{profile.username}</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`admin-tab ${activeTab === tab ? 'admin-tab-active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content" key={activeTab}>
        {activeTab === 'Overview' && <UserOverview profile={profile} onRefresh={fetchProfile} />}
        {activeTab === 'Cards' && <CardManager cards={profile.cards} discordId={discordId} onRefresh={fetchProfile} />}
        {activeTab === 'Stones' && <StoneManager stones={profile.stones} discordId={discordId} onRefresh={fetchProfile} />}
        {activeTab === 'Inventory' && <InventoryManager items={profile.inventory} discordId={discordId} onUpdate={fetchProfile} />}
        {activeTab === 'Level Rewards' && <LevelRewardsTab discordId={discordId} />}
        {activeTab === 'Transactions' && <TransactionsTab transactions={profile.transactions} discordId={discordId} />}
        {activeTab === 'Actions' && <ActionsTab profile={profile} discordId={discordId} onRefresh={fetchProfile} />}
      </div>
    </>
  );
}

function TransactionsTab({ transactions: initialTransactions, discordId }: { transactions: any[]; discordId: string }) {
  const [transactions, setTransactions] = useState<any[]>(initialTransactions);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(initialTransactions.length);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [txType, setTxType] = useState<'lunari' | 'cards' | 'stones'>('lunari');
  const activeTypeRef = useRef(txType);
  activeTypeRef.current = txType;

  const fetchPage = useCallback(async (p: number, type: string = txType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${discordId}/transactions?page=${p}&limit=50&type=${type}`);
      if (!res.ok) throw new Error('Failed');
      if (type !== activeTypeRef.current) return; // stale request, discard
      const data = await res.json();
      setTransactions(data.transactions);
      setPage(data.page);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch {
      // Keep current data on error
    } finally {
      setLoading(false);
    }
  }, [discordId, txType]);

  // Fetch page 1 on mount to get the real total count
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      fetchPage(1);
    }
  }, [initialized, fetchPage]);

  const handleTypeChange = (newType: 'lunari' | 'cards' | 'stones') => {
    setTxType(newType);
    fetchPage(1, newType);
  };

  if (transactions.length === 0 && !loading) {
    return <div className="admin-empty"><p>No transactions found</p></div>;
  }

  return (
    <div className="admin-table-container">
      <div className="admin-tabs" style={{ marginBottom: 12 }}>
        {([['lunari', 'Lunari'], ['cards', 'Cards'], ['stones', 'Stones']] as const).map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab ${txType === key ? 'admin-tab-active' : ''}`}
            onClick={() => handleTypeChange(key)}
            disabled={loading}
          >
            {label}
          </button>
        ))}
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            {txType === 'lunari' && <th>Before</th>}
            {txType === 'lunari' && <th>After</th>}
            {txType !== 'lunari' && <th>Details</th>}
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t: any, i: number) => (
            <tr key={t._id ?? i}>
              <td>
                {(() => {
                  const info = getTransactionTypeInfo(t.type);
                  return (
                    <span className={`admin-badge ${info.color}`}>
                      <span>{info.icon}</span>
                      {info.label}
                    </span>
                  );
                })()}
              </td>
              <td>
                {(() => {
                  const amt = t.amount ?? 0;
                  return (
                    <span className={`admin-tx-amount ${amt >= 0 ? 'positive' : 'negative'}`}>
                      {amt >= 0 ? '+' : ''}{amt.toLocaleString()}
                    </span>
                  );
                })()}
              </td>
              {txType === 'lunari' && <td>{t.balanceBefore?.toLocaleString() ?? '-'}</td>}
              {txType === 'lunari' && <td>{t.balanceAfter?.toLocaleString() ?? '-'}</td>}
              {txType !== 'lunari' && (
                <td className="admin-tx-details">
                  {t.metadata?.cardName || t.metadata?.stoneName || t.metadata?.rarity || t.metadata?.reason || '-'}
                </td>
              )}
              <td className="admin-tx-time">
                {t.timestamp ? new Date(t.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-pagination">
          <span className="admin-pagination-info">
            Page {page} of {totalPages} ({total.toLocaleString()} transactions)
          </span>
          <div className="admin-pagination-buttons">
            <button
              className="admin-pagination-btn"
              disabled={page <= 1 || loading}
              onClick={() => fetchPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pagination-btn"
              disabled={page >= totalPages || loading}
              onClick={() => fetchPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {loading && (
        <div style={{ textAlign: 'center', padding: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Loading...
        </div>
      )}
    </div>
  );
}

function ActionsTab({ profile, discordId, onRefresh }: { profile: AdminUserProfile; discordId: string; onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [pendingAction, setPendingAction] = useState<{ url: string; method: string; body: any; label: string } | null>(null);

  const getCsrfToken = () => {
    const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
    return match?.[1] ?? '';
  };

  const doAction = async (url: string, method: string, bodyData: any, label: string) => {
    setActionLoading(label);
    setActionResult('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok) { setActionResult(`Error: ${data.error}`); return; }
      setActionResult(`${label} successful`);
      onRefresh();
    } catch {
      setActionResult(`Error: ${label} failed`);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="admin-actions-layout">
      {/* User Stats Overview */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Balance</span>
            <div className="admin-stat-icon gold">L</div>
          </div>
          <div className="admin-stat-value">{profile.balance.toLocaleString()}</div>
          <div className="admin-stat-sub">Lunari</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Level</span>
            <div className="admin-stat-icon cyan">Lv</div>
          </div>
          <div className="admin-stat-value">{profile.level ?? 0}</div>
          <div className="admin-stat-sub">{(profile.xp ?? 0).toLocaleString()} XP</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Tickets</span>
            <div className="admin-stat-icon purple">T</div>
          </div>
          <div className="admin-stat-value">{profile.tickets.toLocaleString()}</div>
          <div className="admin-stat-sub">Game tickets</div>
        </div>
      </div>

      <BalanceModifier discordId={discordId} currentBalance={profile.balance} onSuccess={onRefresh} />
      <LevelModifier discordId={discordId} currentLevel={profile.level ?? 0} onSuccess={onRefresh} />
      <TicketsModifier discordId={discordId} currentTickets={profile.tickets} onSuccess={onRefresh} />

      <div className="admin-stat-card">
        <h3 className="admin-section-title">Quick Actions</h3>
        <div className="admin-actions-row">
          <button
            className={`admin-btn admin-btn-danger ${actionLoading === 'Reset cooldowns' ? 'admin-btn-loading' : ''}`}
            disabled={actionLoading !== ''}
            onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/cooldowns`, method: 'DELETE', body: { reason: 'Admin manual reset' }, label: 'Reset cooldowns' })}
          >
            {actionLoading === 'Reset cooldowns' ? 'Resetting...' : '🔄 Reset Cooldowns'}
          </button>
          {profile.debt > 0 && (
            <button
              className={`admin-btn admin-btn-danger ${actionLoading === 'Clear debt' ? 'admin-btn-loading' : ''}`}
              disabled={actionLoading !== ''}
              onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/debt`, method: 'DELETE', body: { reason: 'Admin cleared debt' }, label: 'Clear debt' })}
            >
              {actionLoading === 'Clear debt' ? 'Clearing...' : `🧹 Clear Debt (${profile.debt.toLocaleString()})`}
            </button>
          )}
          {profile.loans.length > 0 && (
            <button
              className={`admin-btn admin-btn-danger ${actionLoading === 'Cancel loans' ? 'admin-btn-loading' : ''}`}
              disabled={actionLoading !== ''}
              onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/loans`, method: 'DELETE', body: { reason: 'Admin cancelled loans' }, label: 'Cancel loans' })}
            >
              {actionLoading === 'Cancel loans' ? 'Cancelling...' : `❌ Cancel Loans (${profile.loans.length})`}
            </button>
          )}
        </div>
        {actionResult && (
          <p className={`admin-inline-result ${actionResult.startsWith('Error') ? 'error' : 'success'}`}>
            {actionResult}
          </p>
        )}
      </div>

      {pendingAction && (
        <ConfirmModal
          title="Confirm Action"
          message={`Are you sure you want to ${pendingAction.label}?`}
          confirmLabel={pendingAction.label}
          variant="danger"
          onConfirm={() => {
            const { url, method, body, label } = pendingAction;
            setPendingAction(null);
            doAction(url, method, body, label);
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function LevelRewardsTab({ discordId }: { discordId: string }) {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardsError, setRewardsError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/users/${discordId}/level-rewards`)
      .then(r => r.json())
      .then(d => setRewards(d.rewards ?? []))
      .catch(() => setRewardsError('Failed to load level rewards'))
      .finally(() => setLoading(false));
  }, [discordId]);

  if (loading) return <div className="admin-loading"><div className="admin-spinner" />Loading level rewards...</div>;

  if (rewardsError) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-icon">!</div>
        <p>{rewardsError}</p>
      </div>
    );
  }

  const allLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const grantedLevels = new Set(rewards.map(r => r.level));

  return (
    <div className="admin-stat-card">
      <h3 className="admin-section-title">Jester Level Milestone Rewards</h3>
      <p className="admin-section-desc">
        Tracks which milestone level rewards this user has received. Green = received, gray = not yet.
      </p>
      <div className="admin-milestone-grid">
        {allLevels.map(level => {
          const reward = rewards.find(r => r.level === level);
          const granted = grantedLevels.has(level);
          return (
            <div key={level} className={`admin-milestone-item ${granted ? 'granted' : ''}`}>
              <div>
                <div className="admin-milestone-level">Level {level}</div>
                {reward && (
                  <div className="admin-milestone-detail">
                    {reward.lunariReward?.toLocaleString()} L{reward.ticketsReward > 0 ? ` + ${reward.ticketsReward} tickets` : ''}
                  </div>
                )}
              </div>
              <div className={`admin-milestone-check ${granted ? 'granted' : ''}`}>
                {granted ? '\u2713' : '\u2014'}
              </div>
            </div>
          );
        })}
      </div>
      {rewards.length > 0 && (
        <div className="admin-milestone-footer">
          Last reward: Level {Math.max(...rewards.map(r => r.level))} —{' '}
          {(() => {
            const last = rewards.reduce((a, b) => (a.level > b.level ? a : b));
            return last.grantedAt ? new Date(last.grantedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'unknown time';
          })()}
        </div>
      )}
    </div>
  );
}
