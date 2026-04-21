'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import PartnersPanel from './PartnersPanel';
import LunaMapPanel from './LunaMapPanel';
import FooterPanel from './FooterPanel';
import type { FooterConfig, LunaMapDoc, Partner } from './types';

type Tab = 'partners' | 'lunaMap' | 'footer';

interface Props {
  partners: Partner[];
  lunaMap: LunaMapDoc;
  footer: FooterConfig;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveLunaMap(next: LunaMapDoc): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/shops/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ shop: 'lunamap', config: next }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

async function saveFooter(next: FooterConfig): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/footer', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(next),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

export default function InfoClient({ partners, lunaMap, footer }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [tab, setTab] = useState<Tab>('partners');

  // Luna Map + Footer use cross-doc draft/committed refs; Partners uses per-row mutations
  const [lunaMapDraft, setLunaMapDraft] = useState<LunaMapDoc>(lunaMap);
  const [footerDraft, setFooterDraft] = useState<FooterConfig>(footer);

  const lunaCommitted = useRef<LunaMapDoc>(lunaMap);
  const footerCommitted = useRef<FooterConfig>(footer);

  const queueLunaMapSave = () => {
    pending.queue({
      label: 'Save Luna Map',
      detail: `${lunaMapDraft.buttons?.length ?? 0} buttons`,
      delayMs: 4500,
      run: async () => {
        const snapshot = lunaMapDraft;
        const before = lunaCommitted.current;
        if (JSON.stringify(snapshot) === JSON.stringify(before)) return;
        try {
          await saveLunaMap(snapshot);
          lunaCommitted.current = snapshot;
          toast.show({ tone: 'success', title: 'Saved', message: 'Luna Map' });
          undo.push({
            label: 'Restore Luna Map',
            detail: 'Rolls back to prior snapshot',
            revert: async () => {
              await saveLunaMap(before);
              lunaCommitted.current = before;
              setLunaMapDraft(before);
              toast.show({ tone: 'success', title: 'Reverted', message: 'Luna Map' });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const queueFooterSave = () => {
    pending.queue({
      label: 'Save Footer',
      detail: `${footerDraft.columns.length} columns · ${footerDraft.socialLinks.length} socials`,
      delayMs: 4500,
      run: async () => {
        const snapshot = footerDraft;
        const before = footerCommitted.current;
        if (JSON.stringify(snapshot) === JSON.stringify(before)) return;
        try {
          await saveFooter(snapshot);
          footerCommitted.current = snapshot;
          toast.show({ tone: 'success', title: 'Saved', message: 'Footer' });
          undo.push({
            label: 'Restore Footer',
            detail: 'Rolls back to prior snapshot',
            revert: async () => {
              await saveFooter(before);
              footerCommitted.current = before;
              setFooterDraft(before);
              toast.show({ tone: 'success', title: 'Reverted', message: 'Footer' });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const patchLunaMap = (next: LunaMapDoc) => {
    setLunaMapDraft(next);
    queueLunaMapSave();
  };

  const patchFooter = (next: FooterConfig) => {
    setFooterDraft(next);
    queueFooterSave();
  };

  const buttonCount = lunaMapDraft.buttons?.length ?? 0;
  const footerSummary = footerDraft.columns.length + (footerDraft.socialLinks?.length ?? 0);

  return (
    <div className="av-info">
      <nav className="av-inbox-chipset" role="tablist" aria-label="Info section">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'partners'}
          className={`av-inbox-chip${tab === 'partners' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('partners')}
        >Partners · {partners.length}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'lunaMap'}
          className={`av-inbox-chip${tab === 'lunaMap' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('lunaMap')}
        >Luna Map · {buttonCount}</button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'footer'}
          className={`av-inbox-chip${tab === 'footer' ? ' av-inbox-chip--active' : ''}`}
          onClick={() => setTab('footer')}
        >Footer · {footerSummary}</button>
      </nav>

      {tab === 'partners' && <PartnersPanel initial={partners} />}
      {tab === 'lunaMap'  && <LunaMapPanel data={lunaMapDraft} onChange={patchLunaMap} />}
      {tab === 'footer'   && <FooterPanel data={footerDraft} onChange={patchFooter} />}
    </div>
  );
}
