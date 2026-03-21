'use client';

import type { AdminUserProfile } from '@/types/admin';
import StatCard from '../../../components/StatCard';

interface Props {
  profile: AdminUserProfile;
  onRefresh: () => void;
}

export default function UserOverview({ profile }: Props) {
  return (
    <div>
      <div className="admin-stats-grid">
        <StatCard label="Balance" value={profile.balance} icon="L" color="gold" />
        <StatCard label="Level" value={profile.level ?? 0} icon="^" color="cyan" />
        <StatCard label="XP" value={profile.xp != null ? profile.xp.toLocaleString() : '0'} icon="*" color="purple" />
        <StatCard label="Cards" value={profile.cards.length} icon="#" color="green" />
        <StatCard label="Stones" value={profile.stones.length} icon="S" color="purple" />
        <StatCard label="Inventory" value={profile.inventory.length} icon="I" color="cyan" />
        <StatCard label="Messages" value={profile.messages != null ? profile.messages.toLocaleString() : '0'} icon="M" color="cyan" />
        <StatCard
          label="Voice"
          value={profile.voiceTime != null ? `${Math.floor(profile.voiceTime / 60)}h` : '0h'}
          icon="V"
          color="green"
        />
        <StatCard
          label="Debt"
          value={profile.debt}
          icon="!"
          color="purple"
          trendType={profile.debt > 0 ? 'negative' : 'neutral'}
          trend={profile.debt > 0 ? 'Outstanding' : 'None'}
        />
        <StatCard label="Loans" value={profile.loans.length} icon="$" color="green" />
      </div>

      {/* Cooldowns */}
      {Object.keys(profile.cooldowns).length > 0 && (
        <div className="admin-stat-card admin-mt-20">
          <h3 className="admin-section-title">Active Cooldowns</h3>
          <div className="admin-cooldowns-wrap">
            {Object.entries(profile.cooldowns).map(([key, val]) => {
              const ts = typeof val === 'number' ? val : typeof val === 'string' ? new Date(val).getTime() : 0;
              const isActive = ts > Date.now();
              return (
                <span key={key} className={`admin-badge ${isActive ? 'red' : 'green'}`}>
                  {key}: {isActive ? `${Math.round((ts - Date.now()) / 60000)}m left` : 'expired'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Loans Detail */}
      {profile.loans.length > 0 && (
        <div className="admin-stat-card admin-mt-20">
          <h3 className="admin-section-title">Active Loans</h3>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Remaining</th>
                  <th>Rate</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {profile.loans.map((loan: any, i: number) => (
                  <tr key={i}>
                    <td className="admin-table-cell-bold">{loan.amount?.toLocaleString() ?? '-'}</td>
                    <td>{loan.remaining?.toLocaleString() ?? loan.amount?.toLocaleString() ?? '-'}</td>
                    <td>{loan.interestRate ? `${(loan.interestRate * 100).toFixed(1)}%` : '-'}</td>
                    <td className="admin-tx-time">
                      {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString('en-GB') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
