'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminUserProfile } from '@/types/admin';
import ConfirmModal from '../../components/ConfirmModal';
import BalanceModifier from './components/BalanceModifier';
import CardManager from './components/CardManager';
import StoneManager from './components/StoneManager';
import InventoryManager from './components/InventoryManager';
import UserOverview from './components/UserOverview';
import { getTransactionTypeInfo } from '@/lib/admin/transaction-types';

const tabs = ['Overview', 'Cards', 'Stones', 'Inventory', 'Transactions', 'Actions'] as const;
type Tab = typeof tabs[number];

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const discordId = params.discordId as string;

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

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
        <button className="admin-btn admin-btn-ghost" onClick={() => router.push('/admin/users')} style={{ marginTop: 16 }}>
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="admin-btn admin-btn-ghost" onClick={() => router.push('/admin/users')} style={{ padding: '6px 10px' }}>
          &larr;
        </button>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '2px solid rgba(0,212,255,0.3)',
          background: 'rgba(0,212,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {profile.image ? (
            <img src={profile.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 22, color: 'var(--accent-primary)', fontWeight: 700 }}>
              {(profile.globalName || profile.username || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="admin-page-title">
            {profile.globalName || profile.username || 'Unknown User'}
          </h1>
          <p className="admin-page-subtitle" style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
            {discordId}
            {profile.username && profile.globalName && profile.username !== profile.globalName && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>@{profile.username}</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(0,212,255,0.1)', paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? 'rgba(0,212,255,0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && <UserOverview profile={profile} onRefresh={fetchProfile} />}
      {activeTab === 'Cards' && <CardManager cards={profile.cards} discordId={discordId} onRefresh={fetchProfile} />}
      {activeTab === 'Stones' && <StoneManager stones={profile.stones} discordId={discordId} onRefresh={fetchProfile} />}
      {activeTab === 'Inventory' && <InventoryManager items={profile.inventory} discordId={discordId} onUpdate={fetchProfile} />}
      {activeTab === 'Transactions' && <TransactionsTab transactions={profile.transactions} />}
      {activeTab === 'Actions' && <ActionsTab profile={profile} discordId={discordId} onRefresh={fetchProfile} />}
    </>
  );
}

function TransactionsTab({ transactions }: { transactions: any[] }) {
  if (transactions.length === 0) {
    return <div className="admin-empty"><p>No transactions found</p></div>;
  }

  return (
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Before</th>
            <th>After</th>
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
                    <span className={`admin-badge ${info.color}`} style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>{info.icon}</span>
                      {info.label}
                    </span>
                  );
                })()}
              </td>
              <td style={{
                color: t.amount >= 0 ? 'var(--common)' : '#f43f5e',
                fontWeight: 600,
                textShadow: t.amount >= 0 ? '0 0 8px rgba(74, 222, 128, 0.3)' : '0 0 8px rgba(244, 63, 94, 0.3)',
              }}>
                {t.amount >= 0 ? '+' : ''}{t.amount?.toLocaleString()}
              </td>
              <td>{t.balanceBefore?.toLocaleString() ?? '-'}</td>
              <td>{t.balanceAfter?.toLocaleString() ?? '-'}</td>
              <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {t.timestamp ? new Date(t.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BalanceModifier discordId={discordId} currentBalance={profile.balance} onSuccess={onRefresh} />

      <div className="admin-stat-card">
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Quick Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            className="admin-btn admin-btn-danger"
            disabled={actionLoading !== ''}
            onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/cooldowns`, method: 'DELETE', body: { reason: 'Admin manual reset' }, label: 'Reset cooldowns' })}
          >
            {actionLoading === 'Reset cooldowns' ? 'Resetting...' : 'Reset Cooldowns'}
          </button>
          {profile.debt > 0 && (
            <button
              className="admin-btn admin-btn-danger"
              disabled={actionLoading !== ''}
              onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/debt`, method: 'DELETE', body: { reason: 'Admin cleared debt' }, label: 'Clear debt' })}
            >
              {actionLoading === 'Clear debt' ? 'Clearing...' : `Clear Debt (${profile.debt.toLocaleString()})`}
            </button>
          )}
          {profile.loans.length > 0 && (
            <button
              className="admin-btn admin-btn-danger"
              disabled={actionLoading !== ''}
              onClick={() => setPendingAction({ url: `/api/admin/users/${discordId}/loans`, method: 'DELETE', body: { reason: 'Admin cancelled loans' }, label: 'Cancel loans' })}
            >
              {actionLoading === 'Cancel loans' ? 'Cancelling...' : `Cancel Loans (${profile.loans.length})`}
            </button>
          )}
        </div>
        {actionResult && (
          <p style={{ marginTop: 12, fontSize: 13, color: actionResult.startsWith('Error') ? '#f43f5e' : 'var(--common)' }}>
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
