'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useFocusTrap } from '../_components/a11y';
import type { ChallengeTemplate, ChannelOption, CreateBody, ChallengeType } from './types';

interface Props {
  templates: ChallengeTemplate[];
  channels: ChannelOption[];
  onCreated: (challengeId: string) => void;
  onClose: () => void;
  onTemplateSaved: (template: ChallengeTemplate) => void;
  onTemplateDeleted: (templateId: string) => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function postChallenge(body: CreateBody): Promise<{ challengeId: string; message: string }> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function postTemplate(body: {
  name: string;
  type: ChallengeType;
  description?: string;
  reward1st?: number;
  reward2nd?: number;
  reward3rd?: number;
  duration?: number;
}): Promise<{ template: ChallengeTemplate }> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function deleteTemplate(templateId: string): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/challenges/templates', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ templateId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function CreateDialog({ templates, channels, onCreated, onClose, onTemplateSaved, onTemplateDeleted }: Props) {
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChallengeType>('image');
  const [submissionChannelId, setSubmissionChannelId] = useState('');
  const [votingChannelId, setVotingChannelId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [reward1st, setReward1st] = useState(100);
  const [reward2nd, setReward2nd] = useState(50);
  const [reward3rd, setReward3rd] = useState(25);
  const [duration, setDuration] = useState(24);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const [channelSearch, setChannelSearch] = useState('');

  const visibleChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return q ? channels.filter((c) => c.name.toLowerCase().includes(q) || c.parentName.toLowerCase().includes(q)) : channels;
  }, [channels, channelSearch]);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setName(t.name);
    setType(t.type);
    setDescription(t.description ?? '');
    if (t.reward1st != null) setReward1st(t.reward1st);
    if (t.reward2nd != null) setReward2nd(t.reward2nd);
    if (t.reward3rd != null) setReward3rd(t.reward3rd);
    if (t.duration != null) setDuration(t.duration);
  };

  const saveAsTemplate = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.show({ tone: 'warn', title: 'Name first', message: 'Fill the challenge name before saving as a template.' }); return; }
    try {
      const { template } = await postTemplate({
        name: trimmed,
        type,
        description: description.trim() || undefined,
        reward1st: reward1st || undefined,
        reward2nd: reward2nd || undefined,
        reward3rd: reward3rd || undefined,
        duration: duration || undefined,
      });
      onTemplateSaved(template);
      toast.show({ tone: 'success', title: 'Template saved', message: template.name });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    }
  };

  const removeTemplate = async (id: string, label: string) => {
    try {
      await deleteTemplate(id);
      onTemplateDeleted(id);
      toast.show({ tone: 'success', title: 'Template deleted', message: label });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.show({ tone: 'warn', title: 'Name required', message: 'Give the challenge a name.' }); return; }
    if (!/^\d{17,20}$/.test(submissionChannelId)) {
      toast.show({ tone: 'warn', title: 'Submission channel', message: 'Pick a submission channel.' }); return;
    }
    if (!/^\d{17,20}$/.test(votingChannelId)) {
      toast.show({ tone: 'warn', title: 'Voting channel', message: 'Pick a voting channel.' }); return;
    }
    if (scheduled && !scheduledAt) {
      toast.show({ tone: 'warn', title: 'Schedule date', message: 'Pick a schedule date or uncheck "Schedule for later".' }); return;
    }

    const body: CreateBody = {
      name: trimmed,
      description: description.trim() || undefined,
      type,
      submissionChannelId,
      votingChannelId,
      logChannelId: logChannelId && /^\d{17,20}$/.test(logChannelId) ? logChannelId : undefined,
      reward1st: reward1st || undefined,
      reward2nd: reward2nd || undefined,
      reward3rd: reward3rd || undefined,
      duration: duration || undefined,
      scheduledAt: scheduled ? new Date(scheduledAt).toISOString() : undefined,
    };

    setBusy(true);
    try {
      const { challengeId } = await postChallenge(body);
      toast.show({ tone: 'success', title: scheduled ? 'Scheduled' : 'Launched', message: trimmed });
      onCreated(challengeId);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Launch failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const previewReward = [
    reward1st > 0 ? `🥇 ${reward1st.toLocaleString()}` : null,
    reward2nd > 0 ? `🥈 ${reward2nd.toLocaleString()}` : null,
    reward3rd > 0 ? `🥉 ${reward3rd.toLocaleString()}` : null,
  ].filter(Boolean).join(' · ') || 'No Lunari rewards';

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-itemdialog av-challenges-create-dialog" role="dialog" aria-modal="true" aria-label="Create challenge">
        <header className="av-itemdialog-head">
          <div>
            <h3>{scheduled ? 'Schedule challenge' : 'Launch challenge'}</h3>
            <p>The bot picks it up within ~60 s. You can still cancel inside the 5 s confirmation ring.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} disabled={busy}>×</button>
        </header>

        <div className="av-itemdialog-body">
          <div className="av-challenges-preview">
            <div className="av-challenges-preview-head">
              <strong>{name.trim() || 'Untitled challenge'}</strong>
              <span className={`av-inbox-status-badge`} data-tone={scheduled ? 'gold' : 'cyan'}>{scheduled ? 'scheduled' : 'active'}</span>
            </div>
            {description && <p className="av-challenges-preview-desc">{description.slice(0, 160)}</p>}
            <div className="av-challenges-preview-rewards">{previewReward}</div>
            <div className="av-challenges-preview-meta">
              type: <code>{type}</code>
              {duration > 0 && <> · runs for <strong>{duration}h</strong></>}
              {scheduled && scheduledAt && <> · starts <strong>{new Date(scheduledAt).toLocaleString()}</strong></>}
            </div>
          </div>

          {templates.length > 0 && (
            <div className="av-challenges-template-row">
              <label className="av-games-field-label">Load from template</label>
              <div className="av-challenges-template-chips">
                {templates.map((t) => (
                  <div key={t.id} className="av-challenges-template-chip">
                    <button type="button" onClick={() => applyTemplate(t.id)}>{t.name}</button>
                    <button
                      type="button"
                      className="av-challenges-template-chip-x"
                      title="Delete template"
                      onClick={() => removeTemplate(t.id, t.name)}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="av-itemdialog-fields av-challenges-fields">
            <label className="av-shopf-field av-shopf-field--full">
              <span>Name</span>
              <input className="av-shopf-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>

            <label className="av-shopf-field av-shopf-field--full">
              <span>Description</span>
              <textarea className="av-shopf-input" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — what are players submitting?" />
            </label>

            <label className="av-shopf-field">
              <span>Type</span>
              <select className="av-shopf-input" value={type} onChange={(e) => setType(e.target.value as ChallengeType)}>
                <option value="image">Image</option>
                <option value="text">Text</option>
                <option value="link">Link</option>
              </select>
            </label>

            <label className="av-shopf-field">
              <span>Duration (hours)</span>
              <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={720} step={1}
                value={duration} onChange={(e) => setDuration(Math.max(0, Math.min(720, Number(e.target.value) || 0)))} />
            </label>

            <div className="av-shopf-field av-shopf-field--full av-challenges-channel-picker">
              <span>Channels</span>
              <input
                className="av-shopf-input"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder={`Filter ${channels.length} text channels…`}
              />
              <div className="av-challenges-channel-grid">
                <div>
                  <label className="av-challenges-channel-label">Submission</label>
                  <select
                    className="av-shopf-input"
                    value={submissionChannelId}
                    onChange={(e) => setSubmissionChannelId(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {visibleChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name} — {c.parentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="av-challenges-channel-label">Voting</label>
                  <select
                    className="av-shopf-input"
                    value={votingChannelId}
                    onChange={(e) => setVotingChannelId(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {visibleChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name} — {c.parentName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="av-challenges-channel-label">Log (optional)</label>
                  <select
                    className="av-shopf-input"
                    value={logChannelId}
                    onChange={(e) => setLogChannelId(e.target.value)}
                  >
                    <option value="">None</option>
                    {visibleChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name} — {c.parentName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="av-shopf-field av-shopf-field--full av-challenges-reward-tiers">
              <span>Rewards (Lunari)</span>
              <div className="av-challenges-reward-row">
                <span className="av-challenges-medal">🥇</span>
                <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={1_000_000} step={100}
                  value={reward1st} onChange={(e) => setReward1st(Math.max(0, Math.min(1_000_000, Number(e.target.value) || 0)))} />
                <span className="av-games-field-unit">Lunari</span>
              </div>
              <div className="av-challenges-reward-row">
                <span className="av-challenges-medal">🥈</span>
                <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={1_000_000} step={100}
                  value={reward2nd} onChange={(e) => setReward2nd(Math.max(0, Math.min(1_000_000, Number(e.target.value) || 0)))} />
                <span className="av-games-field-unit">Lunari</span>
              </div>
              <div className="av-challenges-reward-row">
                <span className="av-challenges-medal">🥉</span>
                <input className="av-shopf-input av-shopf-input--num" type="number" min={0} max={1_000_000} step={100}
                  value={reward3rd} onChange={(e) => setReward3rd(Math.max(0, Math.min(1_000_000, Number(e.target.value) || 0)))} />
                <span className="av-games-field-unit">Lunari</span>
              </div>
            </div>

            <div className="av-shopf-field av-shopf-field--full">
              <label className="av-challenges-schedule-row">
                <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />
                <span>Schedule for later</span>
              </label>
              {scheduled && (
                <input
                  className="av-shopf-input"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={saveAsTemplate} disabled={busy}>💾 Save as template</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Launching…' : scheduled ? 'Schedule challenge' : 'Launch challenge'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
