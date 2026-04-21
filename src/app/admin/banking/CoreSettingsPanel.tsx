'use client';

import { useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { saveBankingSection } from './BankingClient';

interface Props {
  enabled: boolean;
  tradeLevel: number;
  investorInterest: number;
  overdueDebtRoleId: string;
  investorDepositRoleId: string;
  onSaved: (patch: any) => void;
}

export default function CoreSettingsPanel(p: Props) {
  const toast = useToast();
  const pending = usePendingAction();

  const [enabled, setEnabled] = useState(p.enabled);
  const [tradeLevel, setTradeLevel] = useState(p.tradeLevel);
  const [investorInterest, setInvestorInterest] = useState(p.investorInterest);
  const [overdueRole, setOverdueRole] = useState(p.overdueDebtRoleId);
  const [investorRole, setInvestorRole] = useState(p.investorDepositRoleId);

  const dirty =
    enabled !== p.enabled ||
    tradeLevel !== p.tradeLevel ||
    investorInterest !== p.investorInterest ||
    overdueRole !== p.overdueDebtRoleId ||
    investorRole !== p.investorDepositRoleId;

  const save = () => {
    const payload = {
      enabled,
      trade_level: tradeLevel,
      investor_interest: investorInterest,
      overdue_debt_role_id: overdueRole,
      investor_deposit_role_id: investorRole,
    };
    pending.queue({
      label: "Save Avelle's core settings",
      detail: enabled ? 'Bank open · accepting loans' : 'Bank CLOSED — players cannot take loans',
      delayMs: 4500,
      tone: enabled ? 'default' : 'danger',
      run: async () => {
        try {
          await saveBankingSection('core', payload);
          p.onSaved(payload);
          toast.show({ tone: 'success', title: 'Saved', message: 'Core settings updated.' });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-banking-panel">
      <header className="av-banking-panel-head">
        <div>
          <h3>Core settings</h3>
          <p>Master switches + role assignments. Turning the bank off stops Avelle from taking new loans immediately.</p>
        </div>
        {dirty && (
          <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={save}>Save core</button>
        )}
      </header>

      {/* Master switch */}
      <div className={`av-banking-core-toggle${enabled ? '' : ' av-banking-core-toggle--off'}`}>
        <button
          type="button"
          className={`av-se-toggle${enabled ? ' av-se-toggle--on' : ''}`}
          onClick={() => setEnabled((v) => !v)}
          aria-pressed={enabled}
        >
          <span className="av-se-toggle-knob" />
          <span className="av-se-toggle-text">{enabled ? 'Bank OPEN' : 'Bank CLOSED'}</span>
        </button>
        <div>
          <strong>{enabled ? 'Avelle is accepting business' : 'Avelle has closed the vault'}</strong>
          <p>{enabled
            ? 'Players can take loans, deposit investments, and buy insurance.'
            : 'New loans blocked. Existing loans and investments continue to mature normally.'}</p>
        </div>
      </div>

      <div className="av-banking-core-grid">
        <label className="av-banking-field">
          <span>Trade level · required level to use <code>/trade</code></span>
          <input
            type="number"
            className="av-audit-input"
            min={0}
            max={200}
            value={tradeLevel}
            onChange={(e) => setTradeLevel(Number(e.target.value) || 0)}
          />
          <small>Level 0 = everyone. Level 1 = players with at least level 1 XP.</small>
        </label>

        <label className="av-banking-field">
          <span>Investor bonus interest (%)</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              className="av-audit-input"
              min={0}
              max={500}
              step={1}
              value={Math.round(investorInterest * 100)}
              onChange={(e) => setInvestorInterest((Number(e.target.value) || 0) / 100)}
            />
            <span className="av-text-muted">%</span>
          </div>
          <small>Extra interest paid to users with an active investment.</small>
        </label>

        <label className="av-banking-field">
          <span>Overdue-debt role ID</span>
          <input
            className="av-audit-input"
            value={overdueRole}
            onChange={(e) => setOverdueRole(e.target.value.replace(/\D/g, ''))}
            placeholder="Discord role ID"
            inputMode="numeric"
            maxLength={40}
          />
          <small>Auto-granted to players whose loans are 7+ days overdue. Removed when debt is paid.</small>
        </label>

        <label className="av-banking-field">
          <span>Investor-deposit role ID</span>
          <input
            className="av-audit-input"
            value={investorRole}
            onChange={(e) => setInvestorRole(e.target.value.replace(/\D/g, ''))}
            placeholder="Discord role ID"
            inputMode="numeric"
            maxLength={40}
          />
          <small>Granted while a user has an active investment of at least the minimum deposit.</small>
        </label>
      </div>
    </section>
  );
}
