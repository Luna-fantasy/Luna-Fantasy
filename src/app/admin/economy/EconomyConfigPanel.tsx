'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';

interface DailyReward { amount: number; cooldown: number }
interface Salary { amount: number; cooldown: number }
interface InvestorReward { amount: number; cooldown: number }
interface ChatEvents { messages_per_point_batch: number; points_per_message_batch: number; points_per_invite: number }

const DEFAULTS = {
  daily_reward: { amount: 3000, cooldown: 86_400_000 },
  salary: { amount: 80000, cooldown: 2_592_000_000 },
  investor_reward: { amount: 2000, cooldown: 86_400_000 },
  chat_event_points: { messages_per_point_batch: 10, points_per_message_batch: 5, points_per_invite: 5 },
  baloot_reward: 20000,
};

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/butler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

function msToHuman(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d >= 1) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function EconomyConfigPanel() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [daily, setDaily] = useState<DailyReward>(DEFAULTS.daily_reward);
  const [salary, setSalary] = useState<Salary>(DEFAULTS.salary);
  const [investor, setInvestor] = useState<InvestorReward>(DEFAULTS.investor_reward);
  const [chatEvents, setChatEvents] = useState<ChatEvents>(DEFAULTS.chat_event_points);
  const [baloot, setBaloot] = useState<number>(DEFAULTS.baloot_reward);

  const [savedDaily, setSavedDaily] = useState<DailyReward>(DEFAULTS.daily_reward);
  const [savedSalary, setSavedSalary] = useState<Salary>(DEFAULTS.salary);
  const [savedInvestor, setSavedInvestor] = useState<InvestorReward>(DEFAULTS.investor_reward);
  const [savedChat, setSavedChat] = useState<ChatEvents>(DEFAULTS.chat_event_points);
  const [savedBaloot, setSavedBaloot] = useState<number>(DEFAULTS.baloot_reward);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/butler', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const s = body.sections ?? {};
      // Daily reward: coerce legacy {min, max, cooldown} shape to {amount, cooldown}
      const rawDaily: any = s.daily_reward ?? {};
      const dailyAmount = typeof rawDaily.amount === 'number'
        ? rawDaily.amount
        : typeof rawDaily.max === 'number' ? rawDaily.max
        : typeof rawDaily.min === 'number' ? rawDaily.min
        : DEFAULTS.daily_reward.amount;
      const d: DailyReward = { amount: dailyAmount, cooldown: rawDaily.cooldown ?? DEFAULTS.daily_reward.cooldown };
      const sal = { ...DEFAULTS.salary, ...(s.salary ?? {}) };
      // Investor reward: try new key first, fall back to legacy vip_reward
      const investorSrc = s.investor_reward ?? s.vip_reward ?? {};
      const inv = { ...DEFAULTS.investor_reward, ...investorSrc };
      const ce = { ...DEFAULTS.chat_event_points, ...(s.chat_event_points ?? {}) };
      const bal = typeof s.baloot_reward === 'number' ? s.baloot_reward : DEFAULTS.baloot_reward;
      setDaily(d); setSavedDaily(d);
      setSalary(sal); setSavedSalary(sal);
      setInvestor(inv); setSavedInvestor(inv);
      setChatEvents(ce); setSavedChat(ce);
      setBaloot(bal); setSavedBaloot(bal);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (open && loading) void load(); }, [open, loading, load]);

  const makeSaver = (section: string, label: string, getValue: () => any, setSavedFn: (v: any) => void, getBefore: () => any) => () => {
    const value = getValue();
    const before = getBefore();
    pending.queue({
      label: `Save ${label}`,
      detail: 'Butler reads within ~30s · No restart',
      delayMs: 4500,
      run: async () => {
        try {
          await saveSection(section, value);
          setSavedFn(value);
          toast.show({ tone: 'success', title: 'Saved', message: label });
          undo.push({
            label: `Restore ${label}`,
            detail: 'Prior value',
            revert: async () => {
              await saveSection(section, before);
              setSavedFn(before);
              toast.show({ tone: 'success', title: 'Reverted', message: label });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const dailyDirty = JSON.stringify(daily) !== JSON.stringify(savedDaily);
  const salaryDirty = JSON.stringify(salary) !== JSON.stringify(savedSalary);
  const investorDirty = JSON.stringify(investor) !== JSON.stringify(savedInvestor);
  const chatDirty = JSON.stringify(chatEvents) !== JSON.stringify(savedChat);
  const balootDirty = baloot !== savedBaloot;

  const saveDaily = makeSaver('daily_reward', 'Daily reward', () => daily, (v) => { setDaily(v); setSavedDaily(v); }, () => savedDaily);
  const saveSalary = makeSaver('salary', 'Salary', () => salary, (v) => { setSalary(v); setSavedSalary(v); }, () => savedSalary);
  const saveInvestor = makeSaver('investor_reward', 'Investor daily bonus', () => investor, (v) => { setInvestor(v); setSavedInvestor(v); }, () => savedInvestor);
  const saveChat = makeSaver('chat_event_points', 'Chat event points', () => chatEvents, (v) => { setChatEvents(v); setSavedChat(v); }, () => savedChat);
  const saveBaloot = makeSaver('baloot_reward', 'Baloot reward', () => baloot, (v) => { setBaloot(v); setSavedBaloot(v); }, () => savedBaloot);

  return (
    <section className="av-surface">
      <header className="av-flows-head">
        <div>
          <h3>Economy configuration</h3>
          <p>Tune daily/salary/investor payouts, chat event rewards, and Baloot reward. Butler reloads within ~30s.</p>
        </div>
        <div className="av-flows-actions">
          <button type="button" className="av-btn av-btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Open editor'}
          </button>
        </div>
      </header>

      {open && (
        <div className="av-leveling-config">
          {loading && <div className="av-commands-empty">Loading current values…</div>}

          {!loading && (
            <>
              {/* Daily reward */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Daily reward <code>/daily</code></label>
                  {dailyDirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveDaily}>Save</button>}
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Lunari amount</span>
                    <input type="number" min={0} className="av-shopf-input" value={daily.amount} onChange={(e) => setDaily({ ...daily, amount: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Cooldown</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" min={0} className="av-shopf-input" value={daily.cooldown} onChange={(e) => setDaily({ ...daily, cooldown: Number(e.target.value) || 0 })} />
                      <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)', whiteSpace: 'nowrap' }}>{msToHuman(daily.cooldown)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Salary */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Monthly salary <code>/salary</code></label>
                  {salaryDirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveSalary}>Save</button>}
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Lunari amount</span>
                    <input type="number" min={0} className="av-shopf-input" value={salary.amount} onChange={(e) => setSalary({ ...salary, amount: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Cooldown</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" min={0} className="av-shopf-input" value={salary.cooldown} onChange={(e) => setSalary({ ...salary, cooldown: Number(e.target.value) || 0 })} />
                      <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)', whiteSpace: 'nowrap' }}>{msToHuman(salary.cooldown)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP reward */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Investor daily bonus <span className="av-text-muted" style={{ fontWeight: 'normal', fontSize: 'var(--av-text-xs)' }}>(users with an active bank investment)</span></label>
                  {investorDirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveInvestor}>Save</button>}
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Extra Lunari (on top of /daily)</span>
                    <input type="number" min={0} className="av-shopf-input" value={investor.amount} onChange={(e) => setInvestor({ ...investor, amount: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Cooldown</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" min={0} className="av-shopf-input" value={investor.cooldown} onChange={(e) => setInvestor({ ...investor, cooldown: Number(e.target.value) || 0 })} />
                      <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)', whiteSpace: 'nowrap' }}>{msToHuman(investor.cooldown)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat event rewards */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Chat event rewards</label>
                  {chatDirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveChat}>Save</button>}
                </div>
                <p className="av-games-field-sublabel" style={{ marginBottom: 8 }}>
                  During chat events, users earn Lunari by participating. These are the payout rates.
                </p>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Messages per batch</span>
                    <input type="number" min={1} className="av-shopf-input" value={chatEvents.messages_per_point_batch} onChange={(e) => setChatEvents({ ...chatEvents, messages_per_point_batch: Number(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Lunari per batch</span>
                    <input type="number" min={0} className="av-shopf-input" value={chatEvents.points_per_message_batch} onChange={(e) => setChatEvents({ ...chatEvents, points_per_message_batch: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <span className="av-games-field-sublabel">Lunari per invite</span>
                    <input type="number" min={0} className="av-shopf-input" value={chatEvents.points_per_invite} onChange={(e) => setChatEvents({ ...chatEvents, points_per_invite: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* Baloot reward */}
              <div className="av-leveling-section">
                <div className="av-leveling-section-head">
                  <label className="av-games-field-label">Baloot (card game) win reward</label>
                  {balootDirty && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveBaloot}>Save</button>}
                </div>
                <div className="av-leveling-grid">
                  <div>
                    <span className="av-games-field-sublabel">Lunari per win</span>
                    <input type="number" min={0} className="av-shopf-input" value={baloot} onChange={(e) => setBaloot(Number(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
