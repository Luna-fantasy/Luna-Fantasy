'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import RolePicker from '../_components/RolePicker';
import ChannelPicker from '../_components/ChannelPicker';

type SelunaKind = 'card' | 'stone' | 'role' | 'tickets' | 'background';

interface SelunaItem {
  id: string;
  type: SelunaKind;
  name: string;
  price: number;
  stock: number;
  rarity?: string;
  attack?: number;
  amount?: number;
  roleId?: string;
  imageUrl?: string;
  description?: string;
  thumbnail?: string; // resolved by API
}

interface Schedule {
  duration_hours: number;
  reappear_days: number;
}

interface SelunaData {
  active: boolean;
  startTime: number | null;
  endTime: number | null;
  nextOpenAt: number | null;
  items: SelunaItem[];
  schedule: Schedule;
  channels: string[];
  guildId: string;
  settings: { title: string; description: string; image: string; imageVersion: number };
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function formatTime(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const KIND_LABEL: Record<SelunaKind, string> = {
  card: 'Card',
  stone: 'Stone',
  role: 'Role',
  tickets: 'Tickets',
  background: 'Background',
};

async function uploadSelunaImage(file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const token = await fetchCsrf();
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const res = await fetch('/api/admin/v2/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({
      folder: 'profiles',
      filename: `bg_${Date.now()}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.url as string;
}

export default function SelunaEditor({ tone }: { tone: string }) {
  const toast = useToast();
  const pending = usePendingAction();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SelunaData | null>(null);
  const [items, setItems] = useState<SelunaItem[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({ duration_hours: 24, reappear_days: 30 });
  const [dirtyItems, setDirtyItems] = useState(false);
  const [dirtySchedule, setDirtySchedule] = useState(false);
  const [editing, setEditing] = useState<{ index: number | 'new'; draft: SelunaItem } | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [dirtyChannels, setDirtyChannels] = useState(false);
  const [portrait, setPortrait] = useState<{ title: string; description: string; image: string; imageVersion: number }>({
    // Initial values mirror LunaJesterMain/config.ts:688-691 so the editor
    // never renders blank before the API fetch resolves. The API also falls
    // back to these defaults when the admin hasn't saved an override yet.
    title: 'Seluna - The Moonlight Merchant',
    description:
      'Greetings, traveler. I am Seluna, keeper of rare treasures beneath the moonlight. My shop appears only once each month for 24 hours. Choose wisely.',
    image: 'https://assets.lunarian.app/jester/icons/seluna.png',
    imageVersion: 20260414,
  });
  const [dirtyPortrait, setDirtyPortrait] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const portraitFileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shops/seluna', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body as SelunaData);
      setItems(body.items ?? []);
      setSchedule(body.schedule ?? { duration_hours: 24, reappear_days: 30 });
      setChannels(Array.isArray(body.channels) ? body.channels : []);
      setPortrait({
        title: body.settings?.title ?? '',
        description: body.settings?.description ?? '',
        image: body.settings?.image ?? '',
        imageVersion: body.settings?.imageVersion ?? 0,
      });
      setDirtyItems(false);
      setDirtySchedule(false);
      setDirtyChannels(false);
      setDirtyPortrait(false);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const post = async (action: string, payload: any, label: string, detail: string) => {
    await pending.queue({
      label,
      detail,
      delayMs: 4500,
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/shops/seluna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ action, ...payload }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }
          toast.show({ tone: 'success', title: 'Saved', message: label });
          await load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const saveItems = () => post('set_items', { items }, 'Save Seluna inventory', `${items.length} items total`);
  const saveSchedule = () => post('set_schedule', { schedule }, 'Save Seluna schedule', `${schedule.duration_hours}h · every ${schedule.reappear_days}d`);
  const saveChannels = () => post('set_channels', { channels: channels.filter((c) => /^\d{17,20}$/.test(c)) }, 'Save Seluna default channels', `${channels.length} channel${channels.length === 1 ? '' : 's'}`);
  const savePortrait = () => post('set_settings', { settings: portrait }, 'Save Seluna portrait', 'Bot refreshes open Discord messages live');

  const handlePortraitUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Portrait must be under 4MB.' });
      return;
    }
    setPortraitUploading(true);
    try {
      const url = await uploadSelunaImage(file);
      setPortrait((p) => ({ ...p, image: url, imageVersion: Date.now() }));
      setDirtyPortrait(true);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Hit save to publish.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setPortraitUploading(false);
    }
  };
  const forceOpen = () => post(
    'force_open',
    { duration_hours: schedule.duration_hours, channels: channels.filter((c) => /^\d{17,20}$/.test(c)) },
    'Force open Seluna shop',
    channels.length > 0
      ? `Opens now for ${schedule.duration_hours}h — website + ${channels.length} Discord channel${channels.length === 1 ? '' : 's'}`
      : `Opens website only — no Discord channels configured`,
  );
  const forceClose = () => post('force_close', {}, 'Force close Seluna shop', 'Closes website + all open Discord channels immediately');

  const removeItem = (index: number) => {
    setItems((its) => its.filter((_, i) => i !== index));
    setDirtyItems(true);
  };

  const handleItemSave = (draft: SelunaItem, index: number | 'new') => {
    setItems((its) => {
      if (index === 'new') return [...its, draft];
      return its.map((it, i) => (i === index ? draft : it));
    });
    setDirtyItems(true);
    setEditing(null);
  };

  if (loading || !data) {
    return <div className="av-commands-empty">Loading Seluna…</div>;
  }

  const now = Date.now();
  const countdown = data.active && data.endTime
    ? formatCountdown(data.endTime - now)
    : data.nextOpenAt
      ? formatCountdown(data.nextOpenAt - now)
      : '—';

  const newItemDraft = (): SelunaItem => ({
    id: `item_${Date.now()}`,
    type: 'card',
    name: '',
    price: 100,
    stock: -1,
    rarity: 'RARE',
  });

  return (
    <div className="av-seluna" style={{ ['--vendor-tone' as any]: tone }}>
      {/* HERO — status + quick controls */}
      <section className="av-seluna-hero">
        <div className="av-seluna-status-grid">
          <StatusCell label="Shop state" value={data.active ? 'Open' : 'Closed'} accent={data.active ? '#22c55e' : '#94a3b8'} pulse={data.active} />
          <StatusCell label={data.active ? 'Closes in' : 'Opens in'} value={countdown} />
          <StatusCell label="Opened at" value={formatTime(data.startTime)} mono />
          <StatusCell label="Closes at" value={formatTime(data.endTime)} mono />
        </div>
        <div className="av-seluna-controls">
          <div className="av-seluna-controls-head">
            <strong>Shop controls</strong>
            <span>Website picks up instantly. Jester mirrors to Discord channels below within ~30s.</span>
          </div>
          <div className="av-seluna-controls-row">
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={forceOpen}
              disabled={data.active}
              title={data.active ? 'Shop is already open' : `Force open for ${schedule.duration_hours} hours`}
            >
              <span aria-hidden="true">▶</span> Force open ({schedule.duration_hours}h)
            </button>
            <button
              type="button"
              className="av-btn av-btn-danger"
              onClick={forceClose}
              disabled={!data.active}
              title={data.active ? 'Close the shop right now' : 'Shop is not currently open'}
            >
              <span aria-hidden="true">■</span> Force close
            </button>
          </div>
        </div>
      </section>

      {/* PORTRAIT / NAME / DESCRIPTION — updates Discord embed + website */}
      <article className="av-surface av-seluna-card av-seluna-portrait">
        <header className="av-flows-head">
          <div>
            <h3>Portrait, name &amp; description</h3>
            <p>These drive the Discord shop embed and the website header. Changes propagate to every open Discord shop within ~30s.</p>
          </div>
          {dirtyPortrait && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={savePortrait}>Save portrait</button>}
        </header>
        <div className="av-seluna-portrait-grid">
          <div className="av-seluna-portrait-img">
            {portrait.image ? (
              <img
                src={`${portrait.image.split('?')[0]}${portrait.imageVersion ? `?v=${portrait.imageVersion}` : ''}`}
                alt="Seluna portrait"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="av-seluna-portrait-placeholder">S</span>
            )}
            <button
              type="button"
              className="av-vendor-portrait-change"
              onClick={() => portraitFileRef.current?.click()}
              disabled={portraitUploading}
            >
              <span aria-hidden="true">⬆</span> {portraitUploading ? 'Uploading…' : 'Change portrait'}
            </button>
            <input
              ref={portraitFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePortraitUpload(f);
                e.target.value = '';
              }}
            />
          </div>
          <div className="av-seluna-portrait-fields">
            <label className="av-moddialog-field">
              <span>Display name</span>
              <input
                className="av-audit-input"
                placeholder="Seluna — The Moonlight Merchant"
                value={portrait.title}
                onChange={(e) => { setPortrait((p) => ({ ...p, title: e.target.value })); setDirtyPortrait(true); }}
              />
            </label>
            <label className="av-moddialog-field">
              <span>Description</span>
              <textarea
                className="av-audit-input"
                rows={4}
                placeholder="What the merchant says to players…"
                value={portrait.description}
                onChange={(e) => { setPortrait((p) => ({ ...p, description: e.target.value })); setDirtyPortrait(true); }}
              />
            </label>
            <label className="av-moddialog-field">
              <span>Portrait URL</span>
              <input
                className="av-audit-input"
                placeholder="https://assets.lunarian.app/..."
                value={portrait.image}
                onChange={(e) => {
                  const url = e.target.value;
                  setPortrait((p) => ({ ...p, image: url, imageVersion: url && url !== p.image ? Date.now() : p.imageVersion }));
                  setDirtyPortrait(true);
                }}
              />
              <small>Base R2 URL without <code>?v=</code>. The bot + website append the version you save.</small>
            </label>
          </div>
        </div>
      </article>

      {/* INVENTORY FIRST — the main event */}
      <article className="av-surface av-seluna-card">
        <header className="av-flows-head">
          <div>
            <h3>Inventory · {items.length}</h3>
            <p>Seluna rotates rare cards, stones, roles, ticket bundles, and passport backgrounds. Stock <code>-1</code> means unlimited.</p>
          </div>
          <div className="av-seluna-actions">
            {dirtyItems && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveItems}>Save inventory</button>}
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => setEditing({ index: 'new', draft: newItemDraft() })}
            >
              <span aria-hidden="true">+</span> Add item
            </button>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="av-flows-empty av-seluna-empty">
            No inventory items yet —
            <button
              type="button"
              className="av-shop-empty-add"
              onClick={() => setEditing({ index: 'new', draft: newItemDraft() })}
            >add the first one</button>.
          </div>
        ) : (
          <div className="av-seluna-inventory-grid">
            {items.map((it, i) => (
              <div key={`${it.id}-${i}`} className="av-seluna-item-card" data-kind={it.type}>
                <div className="av-seluna-item-thumb" data-kind={it.type}>
                  {it.thumbnail ? (
                    <img
                      src={it.thumbnail}
                      alt={it.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="av-seluna-item-thumb-glyph">{thumbGlyph(it.type)}</span>
                  )}
                  <span className="av-seluna-item-kind" data-kind={it.type}>{KIND_LABEL[it.type]}</span>
                </div>
                <div className="av-seluna-item-body">
                  <div className="av-seluna-item-name">{it.name || <em>Unnamed</em>}</div>
                  {it.description && <div className="av-seluna-item-desc">{it.description}</div>}
                  <div className="av-seluna-item-meta">
                    <strong>{it.price.toLocaleString()} Lunari</strong>
                    <span className="av-seluna-tag av-seluna-tag--stock">
                      {it.stock === -1 ? '∞ stock' : `${it.stock.toLocaleString()} stock`}
                    </span>
                    {it.type === 'card' && it.rarity && <span className="av-seluna-tag">{it.rarity}</span>}
                    {it.type === 'card' && typeof it.attack === 'number' && it.attack > 0 && <span className="av-seluna-tag">⚔ {it.attack}</span>}
                    {it.type === 'tickets' && typeof it.amount === 'number' && <span className="av-seluna-tag">{it.amount}×</span>}
                  </div>
                  <div className="av-seluna-item-actions">
                    <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => setEditing({ index: i, draft: { ...it } })}>Edit</button>
                    <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => removeItem(i)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* DISCORD CHANNELS */}
      <article className="av-surface av-seluna-card">
        <header className="av-flows-head">
          <div>
            <h3>Discord channels · {channels.length}</h3>
            <p>When you hit <strong>Force open</strong> the Jester bot opens the shop in each channel below. Leave empty for website-only opens.</p>
          </div>
          {dirtyChannels && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveChannels}>Save channels</button>}
        </header>
        <div className="av-seluna-channels">
          {channels.length === 0 && <div className="av-commands-empty">No Discord channels configured.</div>}
          {channels.map((id, i) => (
            <div key={`${id}-${i}`} className="av-seluna-channel-row">
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <ChannelPicker
                  value={id}
                  filter="text"
                  placeholder="Pick a channel"
                  hideFallback
                  onChange={(next) => {
                    setChannels((cs) => cs.map((c, idx) => idx === i ? next : c));
                    setDirtyChannels(true);
                  }}
                />
              </div>
              <button
                type="button"
                className="av-btn av-btn-ghost av-btn-sm"
                onClick={() => { setChannels((cs) => cs.filter((_, idx) => idx !== i)); setDirtyChannels(true); }}
              >Remove</button>
            </div>
          ))}
          <button
            type="button"
            className="av-btn av-btn-ghost av-btn-sm"
            onClick={() => { setChannels((cs) => [...cs, '']); setDirtyChannels(true); }}
          >+ Add channel</button>
        </div>
      </article>

      {/* SCHEDULE */}
      <article className="av-surface av-seluna-card">
        <header className="av-flows-head">
          <div>
            <h3>Schedule</h3>
            <p>How long each appearance lasts, and how often Seluna returns to rotation.</p>
          </div>
          {dirtySchedule && <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={saveSchedule}>Save schedule</button>}
        </header>
        <div className="av-seluna-schedule-grid">
          <label className="av-moddialog-field">
            <span>Duration (hours)</span>
            <input
              type="number"
              min={1}
              max={168}
              className="av-audit-input"
              value={schedule.duration_hours}
              onChange={(e) => { setSchedule((s) => ({ ...s, duration_hours: Number(e.target.value) || 1 })); setDirtySchedule(true); }}
            />
            <small>How long each open window lasts.</small>
          </label>
          <label className="av-moddialog-field">
            <span>Reappear every (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              className="av-audit-input"
              value={schedule.reappear_days}
              onChange={(e) => { setSchedule((s) => ({ ...s, reappear_days: Number(e.target.value) || 1 })); setDirtySchedule(true); }}
            />
            <small>Time between appearances.</small>
          </label>
        </div>
      </article>

      {editing && (
        <SelunaItemDialog
          draft={editing.draft}
          isNew={editing.index === 'new'}
          onClose={() => setEditing(null)}
          onSave={(d) => handleItemSave(d, editing.index)}
        />
      )}
    </div>
  );
}

function thumbGlyph(kind: SelunaKind): string {
  switch (kind) {
    case 'card': return '🃏';
    case 'stone': return '💎';
    case 'role': return '🎭';
    case 'tickets': return '🎟️';
    case 'background': return '🖼️';
  }
}

function StatusCell({ label, value, accent, mono, pulse }: { label: string; value: string; accent?: string; mono?: boolean; pulse?: boolean }) {
  return (
    <div className={`av-seluna-stat${pulse ? ' av-seluna-stat--pulse' : ''}`}>
      <span className="av-seluna-stat-label">{label}</span>
      <strong className="av-seluna-stat-value" style={{ color: accent, fontFamily: mono ? 'ui-monospace, monospace' : undefined, fontSize: mono ? 13 : undefined }}>
        {value}
      </strong>
    </div>
  );
}

function SelunaItemDialog({ draft: initial, isNew, onClose, onSave }: {
  draft: SelunaItem;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: SelunaItem) => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<SelunaItem>(initial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleBackgroundUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Background must be under 4MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadSelunaImage(file);
      setD((x) => ({ ...x, imageUrl: url }));
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Background saved to R2.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="av-peek-scrim" onClick={onClose} />
      <div className="av-moddialog" role="dialog" aria-modal="true" aria-label={isNew ? 'Add Seluna item' : 'Edit Seluna item'} style={{ width: 'min(580px, 94vw)' }}>
        <header>
          <div>
            <h3>{isNew ? 'Add Seluna item' : 'Edit Seluna item'}</h3>
            <p>{KIND_LABEL[d.type]} · rotating lunar merchant</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose}>×</button>
        </header>
        <div className="av-moddialog-body" style={{ gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="av-moddialog-field">
              <span>Internal ID</span>
              <input className="av-audit-input" value={d.id} onChange={(e) => setD((x) => ({ ...x, id: e.target.value.replace(/[^a-z0-9_-]/gi, '') }))} />
            </label>
            <label className="av-moddialog-field">
              <span>Type</span>
              <select
                className="av-audit-input"
                value={d.type}
                onChange={(e) => setD((x) => ({ ...x, type: e.target.value as SelunaKind }))}
              >
                <option value="card">Card</option>
                <option value="stone">Stone</option>
                <option value="role">Role</option>
                <option value="tickets">Tickets</option>
                <option value="background">Background</option>
              </select>
            </label>
          </div>
          <label className="av-moddialog-field">
            <span>Display name</span>
            <input className="av-audit-input" value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} autoFocus />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="av-moddialog-field">
              <span>Price (Lunari)</span>
              <input type="number" className="av-audit-input" value={d.price} onChange={(e) => setD((x) => ({ ...x, price: Number(e.target.value) || 0 }))} />
            </label>
            <label className="av-moddialog-field">
              <span>Stock (-1 = unlimited)</span>
              <input type="number" className="av-audit-input" value={d.stock} onChange={(e) => setD((x) => ({ ...x, stock: Number(e.target.value) || 0 }))} />
            </label>
          </div>
          {d.type === 'card' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="av-moddialog-field">
                <span>Rarity</span>
                <select className="av-audit-input" value={d.rarity ?? 'SECRET'} onChange={(e) => setD((x) => ({ ...x, rarity: e.target.value }))}>
                  <option value="COMMON">COMMON</option>
                  <option value="RARE">RARE</option>
                  <option value="EPIC">EPIC</option>
                  <option value="UNIQUE">UNIQUE</option>
                  <option value="LEGENDARY">LEGENDARY</option>
                  <option value="SECRET">SECRET</option>
                  <option value="SPECIAL">SPECIAL</option>
                </select>
              </label>
              <label className="av-moddialog-field">
                <span>Attack</span>
                <input type="number" className="av-audit-input" value={d.attack ?? 0} onChange={(e) => setD((x) => ({ ...x, attack: Number(e.target.value) || 0 }))} />
              </label>
            </div>
          )}
          {d.type === 'role' && (
            <label className="av-moddialog-field">
              <span>Role</span>
              <RolePicker value={d.roleId ?? ''} onChange={(id) => setD((x) => ({ ...x, roleId: id }))} placeholder="Pick role reward" hideFallback />
            </label>
          )}
          {d.type === 'tickets' && (
            <label className="av-moddialog-field">
              <span>Tickets amount</span>
              <input type="number" className="av-audit-input" value={d.amount ?? 1} onChange={(e) => setD((x) => ({ ...x, amount: Number(e.target.value) || 1 }))} />
            </label>
          )}
          {d.type === 'background' && (
            <div className="av-moddialog-field">
              <span>Background image</span>
              <div className="av-cardedit-uploader">
                <label className="av-cardedit-upload">
                  <input type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleBackgroundUpload(f); e.target.value = ''; }} />
                  <span>{uploading ? 'Uploading…' : '⬆ Upload'}</span>
                </label>
                <input
                  className="av-audit-input"
                  placeholder="…or paste an image URL"
                  value={d.imageUrl ?? ''}
                  onChange={(e) => setD((x) => ({ ...x, imageUrl: e.target.value }))}
                />
              </div>
              {d.imageUrl && (
                <div className="av-seluna-bg-preview">
                  <img src={d.imageUrl} alt="Preview" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
              <small>Stored on R2. Players who buy this can apply it as a passport background.</small>
            </div>
          )}
          <label className="av-moddialog-field">
            <span>Description (optional)</span>
            <textarea className="av-audit-input" rows={2} value={d.description ?? ''} onChange={(e) => setD((x) => ({ ...x, description: e.target.value }))} />
          </label>
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => onSave(d)}
            disabled={
              !d.id.trim() ||
              !d.name.trim() ||
              d.price < 1 ||
              (d.type === 'background' && !(d.imageUrl ?? '').trim()) ||
              (d.type === 'role' && !(d.roleId ?? '').trim())
            }
          >
            {isNew ? 'Add item' : 'Save changes'}
          </button>
        </footer>
      </div>
    </>
  );
}
