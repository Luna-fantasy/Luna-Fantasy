'use client';

import { useMemo, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import PartnerDialog from './PartnerDialog';
import type { Partner } from './types';

interface Props {
  initial: Partner[];
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function createPartner(body: Partner): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/partners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

async function updatePartner(id: string, patch: Partial<Partner>): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/partners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

async function deletePartner(id: string): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch(`/api/admin/partners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': token },
    credentials: 'include',
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

const SOCIAL_EMOJI: Record<string, string> = {
  instagram: '📸',
  x: '✕',
  tiktok: '🎵',
  youtube: '▶',
  whatsapp: '💬',
};

export default function PartnersPanel({ initial }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [partners, setPartners] = useState<Partner[]>(initial);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; partner?: Partner } | null>(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return partners;
    return partners.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.type?.en?.toLowerCase().includes(term) ||
      p.type?.ar?.includes(term),
    );
  }, [partners, q]);

  const handleSave = async (p: Partner) => {
    const isCreate = dialog?.mode === 'create';
    try {
      if (isCreate) {
        await createPartner(p);
        setPartners((prev) => [...prev, p].sort((a, b) => a.order - b.order));
        toast.show({ tone: 'success', title: 'Partner added', message: p.name });
        undo.push({
          label: `Delete ${p.name}`,
          detail: 'Removes this partner',
          revert: async () => {
            await deletePartner(p.id);
            setPartners((prev) => prev.filter((x) => x.id !== p.id));
            toast.show({ tone: 'success', title: 'Removed', message: p.name });
          },
        });
      } else {
        const before = dialog?.partner;
        await updatePartner(p.id, p);
        setPartners((prev) => prev.map((x) => x.id === p.id ? p : x).sort((a, b) => a.order - b.order));
        toast.show({ tone: 'success', title: 'Saved', message: p.name });
        if (before) {
          undo.push({
            label: `Restore ${before.name}`,
            detail: 'Reverts to prior snapshot',
            revert: async () => {
              await updatePartner(before.id, before);
              setPartners((prev) => prev.map((x) => x.id === before.id ? before : x).sort((a, b) => a.order - b.order));
              toast.show({ tone: 'success', title: 'Reverted', message: before.name });
            },
          });
        }
      }
      setDialog(null);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    }
  };

  const handleDelete = (partner: Partner) => {
    pending.queue({
      label: `Delete ${partner.name}`,
      detail: `Removes partner permanently from /partners`,
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          await deletePartner(partner.id);
          setPartners((prev) => prev.filter((x) => x.id !== partner.id));
          toast.show({ tone: 'success', title: 'Deleted', message: partner.name });
          undo.push({
            label: `Restore ${partner.name}`,
            detail: 'Re-creates the partner',
            revert: async () => {
              await createPartner(partner);
              setPartners((prev) => [...prev, partner].sort((a, b) => a.order - b.order));
              toast.show({ tone: 'success', title: 'Restored', message: partner.name });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-info">
      <div className="av-commands-controls">
        <input
          className="av-audit-input"
          placeholder="Filter by name / slug / type…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button type="button" className="av-commands-add" onClick={() => setDialog({ mode: 'create' })}>
          + New partner
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="av-commands-empty">No partners match “{q}”.</div>
      )}

      <div className="av-info-partner-grid">
        {filtered.map((p) => {
          const socialEntries = Object.entries(p.socials ?? {}).filter(([, v]) => v);
          return (
            <article key={p.id} className="av-info-partner-card">
              <div className="av-info-partner-order">#{p.order}</div>
              <div className="av-info-partner-logo">
                {p.logo
                  ? <img src={p.logo} alt="" loading="lazy" />
                  : <span>{p.name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="av-info-partner-body">
                <strong className="av-info-partner-name">{p.name}</strong>
                <span className="av-info-partner-slug">{p.id}</span>
                <span className="av-info-partner-type">
                  {p.type?.en}
                  {p.type?.en && p.type?.ar ? ' · ' : ''}
                  <span dir="rtl">{p.type?.ar}</span>
                </span>
                {socialEntries.length > 0 && (
                  <div className="av-info-partner-socials">
                    {socialEntries.map(([k, v]) => (
                      <a key={k} href={v} target="_blank" rel="noreferrer" title={k}>
                        <span aria-hidden="true">{SOCIAL_EMOJI[k] ?? '↗'}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="av-info-partner-actions">
                <button type="button" className="av-btn av-btn-ghost" onClick={() => setDialog({ mode: 'edit', partner: p })}>Edit</button>
                <button type="button" className="av-commands-delete" onClick={() => handleDelete(p)} title="Delete partner">🗑</button>
              </div>
            </article>
          );
        })}
      </div>

      {dialog && (
        <PartnerDialog
          mode={dialog.mode}
          initial={dialog.partner}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
