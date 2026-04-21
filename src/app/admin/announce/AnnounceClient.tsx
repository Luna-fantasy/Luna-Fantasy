'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';

interface Channel {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string;
  position: number;
}

interface ServerEmoji {
  id: string;
  name: string;
  animated: boolean;
}

type BotId = 'butler' | 'jester' | 'sage' | 'oracle';
interface BotChoice {
  id: BotId;
  label: string;
  available: boolean;
}

interface Props {
  initial?: { channels: Channel[]; emojis: ServerEmoji[]; error?: string };
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function postAnnouncement(body: { botId: BotId; channelId: string; content: string; imageData?: string; imageType?: string }): Promise<{ messageId: string }> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function AnnounceClient({ initial }: Props) {
  const toast = useToast();

  const [channels, setChannels] = useState<Channel[]>(initial?.channels ?? []);
  const [emojis, setEmojis] = useState<ServerEmoji[]>(initial?.emojis ?? []);
  const [loadError, setLoadError] = useState<string | null>(initial?.error ?? null);
  const [loading, setLoading] = useState(!initial);
  const [bots, setBots] = useState<BotChoice[]>([]);
  const [botId, setBotId] = useState<BotId>('oracle');

  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [emojiFilter, setEmojiFilter] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Refetch channel + emoji list whenever the chosen bot changes.
  // Each bot only sees channels it has permission to view, so this matters.
  useEffect(() => {
    if (initial && botId === 'oracle') return; // initial server-render covers oracle case
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/admin/announce?botId=${botId}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (Array.isArray(body?.bots)) setBots(body.bots);
        if (!r.ok) { setLoadError(body?.error || `HTTP ${r.status}`); setChannels([]); setEmojis([]); return; }
        setChannels(Array.isArray(body?.channels) ? body.channels : []);
        setEmojis(Array.isArray(body?.emojis) ? body.emojis : []);
      })
      .catch((e) => { if (!cancelled) setLoadError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initial, botId]);

  const grouped = useMemo(() => {
    const q = channelFilter.trim().toLowerCase();
    const filtered = q ? channels.filter((c) => c.name.toLowerCase().includes(q) || c.parentName.toLowerCase().includes(q)) : channels;
    const map = new Map<string, Channel[]>();
    for (const ch of filtered) {
      if (!map.has(ch.parentName)) map.set(ch.parentName, []);
      map.get(ch.parentName)!.push(ch);
    }
    return Array.from(map.entries())
      .map(([category, list]) => ({ category, channels: list.slice().sort((a, b) => a.position - b.position) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [channels, channelFilter]);

  const visibleEmojis = useMemo(() => {
    const q = emojiFilter.trim().toLowerCase();
    return q ? emojis.filter((e) => e.name.toLowerCase().includes(q)) : emojis;
  }, [emojis, emojiFilter]);

  const handleImageSelect = (file: File | null) => {
    if (!file) { setImageFile(null); setImagePreview(null); return; }
    if (!file.type.startsWith('image/')) { toast.show({ tone: 'error', title: 'Image only', message: 'Upload a PNG, JPEG, WebP or GIF.' }); return; }
    if (file.size > 8 * 1024 * 1024) { toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 8 MB.' }); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  };

  const insertEmoji = (emoji: ServerEmoji) => {
    const token = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
    const ta = textareaRef.current;
    if (!ta) { setContent((c) => c + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    window.setTimeout(() => {
      ta.focus();
      const cursor = start + token.length;
      ta.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const resolveChannelName = (id: string): string => {
    const ch = channels.find((c) => c.id === id);
    if (!ch) return id;
    return `#${ch.name} — ${ch.parentName}`;
  };

  const send = async () => {
    if (!channelId) { toast.show({ tone: 'warn', title: 'Pick a channel', message: 'Choose a destination first.' }); return; }
    if (!content.trim() && !imageFile) { toast.show({ tone: 'warn', title: 'Empty message', message: 'Write something or attach an image.' }); return; }
    setSending(true);
    try {
      let imageData: string | undefined;
      let imageType: string | undefined;
      if (imageFile) {
        imageType = imageFile.type;
        imageData = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const result = r.result as string;
            resolve(result.split(',')[1] ?? '');
          };
          r.onerror = () => reject(new Error('Read failed'));
          r.readAsDataURL(imageFile);
        });
      }
      const { messageId } = await postAnnouncement({ botId, channelId, content, imageData, imageType });
      const botLabel = bots.find((b) => b.id === botId)?.label ?? botId;
      toast.show({ tone: 'success', title: `Posted as ${botLabel}`, message: `#${channels.find((c) => c.id === channelId)?.name ?? channelId}` });
      // Clear compose form, keep channel selection
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.show({ tone: 'error', title: 'Send failed', message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  };

  // Render preview content — replace emoji tokens with their CDN image
  const previewContent = useMemo(() => {
    const parts: Array<{ kind: 'text' | 'emoji'; value: string; emoji?: { id: string; animated: boolean } }> = [];
    const regex = /<(a)?:([A-Za-z0-9_~]+):(\d{15,22})>/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      if (m.index > last) parts.push({ kind: 'text', value: content.slice(last, m.index) });
      const animated = m[1] === 'a';
      parts.push({ kind: 'emoji', value: m[2], emoji: { id: m[3], animated } });
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push({ kind: 'text', value: content.slice(last) });
    return parts;
  }, [content]);

  return (
    <div className="av-announce">
      {loading && <div className="av-commands-banner">Loading channels from Discord…</div>}
      {loadError && (
        <div className="av-commands-banner av-commands-banner--warn">
          <strong>Channel list unavailable</strong>
          <span>{loadError}. You can still paste a channel ID below manually.</span>
        </div>
      )}

      <div className="av-announce-layout">
        <section className="av-announce-compose av-surface">
          <div className="av-announce-field">
            <label className="av-games-field-label">Send as</label>
            <p className="av-games-field-help">
              Pick which bot's identity posts this announcement. Each bot is rendered with its
              configured token. Disabled options have no <code>{`{ID}_BOT_TOKEN`}</code> in env.
            </p>
            <div className="av-announce-bots">
              {(['butler', 'jester', 'sage', 'oracle'] as BotId[]).map((id) => {
                const meta = bots.find((b) => b.id === id);
                const label = meta?.label ?? id;
                const available = meta?.available ?? false;
                const active = botId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`av-announce-bot${active ? ' av-announce-bot--active' : ''}${!available ? ' av-announce-bot--disabled' : ''}`}
                    aria-pressed={active}
                    disabled={!available && !active}
                    title={available ? `Send as ${label}` : `${id.toUpperCase()}_BOT_TOKEN not configured`}
                    onClick={() => available && setBotId(id)}
                  >
                    <span className="av-announce-bot-name">{label}</span>
                    {!available && <span className="av-announce-bot-warn">no token</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="av-announce-field">
            <label className="av-games-field-label">Channel</label>
            <input
              className="av-audit-input"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              placeholder={`Filter ${channels.length} text channels…`}
            />
            <select
              className="av-shopf-input"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              <option value="">Choose a channel…</option>
              {grouped.map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="av-announce-field">
            <label className="av-games-field-label">Message</label>
            <textarea
              ref={textareaRef}
              className="av-shopf-input av-announce-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 4000))}
              onKeyDown={onTextareaKeyDown}
              placeholder="Type your message. Markdown works. Ctrl+Enter to send."
              rows={8}
            />
            <div className="av-announce-counter">
              <span>{content.length} / 4000</span>
              <span>Ctrl+Enter to send</span>
            </div>
          </div>

          <div className="av-announce-field">
            <label className="av-games-field-label">Image (optional)</label>
            <div
              className={`av-announce-dropzone${dragOver ? ' av-announce-dropzone--active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" />
                : <span>Drop an image here or click to pick · max 8 MB</span>}
            </div>
            {imageFile && (
              <button type="button" className="av-btn av-btn-ghost" onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}>
                Remove image
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => { handleImageSelect(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>

          <div className="av-announce-field">
            <label className="av-games-field-label">Custom emoji</label>
            <input
              className="av-audit-input"
              value={emojiFilter}
              onChange={(e) => setEmojiFilter(e.target.value)}
              placeholder={`Filter ${emojis.length} emoji…`}
            />
            <div className="av-announce-emoji-grid">
              {visibleEmojis.length === 0 && <span className="av-announce-emoji-empty">No emojis match.</span>}
              {visibleEmojis.slice(0, 60).map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  className="av-announce-emoji"
                  title={`:${emoji.name}:`}
                  onClick={() => insertEmoji(emoji)}
                >
                  <img
                    src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=32`}
                    alt={emoji.name}
                  />
                </button>
              ))}
            </div>
          </div>

          <footer className="av-announce-foot">
            <span className="av-announce-target">
              {channelId ? <>Posts to <strong>{resolveChannelName(channelId)}</strong></> : <>No channel selected.</>}
            </span>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={send}
              disabled={sending || !channelId || (!content.trim() && !imageFile)}
            >{sending ? 'Sending…' : 'Send announcement'}</button>
          </footer>
        </section>

        <section className="av-announce-preview av-surface">
          <header className="av-announce-preview-head">
            <div className="av-announce-preview-avatar" aria-hidden="true">
              <img src="https://assets.lunarian.app/oracle/oracle_avatar.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span>☾</span>
            </div>
            <div>
              <strong>Oracle</strong>
              <span className="av-announce-preview-time">now · preview</span>
            </div>
          </header>
          <div className="av-announce-preview-body">
            {content.trim() === '' && !imagePreview && (
              <em className="av-announce-preview-empty">Your message will render here exactly like Discord will show it.</em>
            )}
            {content && (
              <div className="av-announce-preview-content">
                {previewContent.map((p, i) => p.kind === 'text'
                  ? <span key={i}>{p.value}</span>
                  : <img
                      key={i}
                      className="av-announce-preview-emoji"
                      src={`https://cdn.discordapp.com/emojis/${p.emoji!.id}.${p.emoji!.animated ? 'gif' : 'png'}?size=32`}
                      alt={p.value}
                      title={p.value}
                    />)}
              </div>
            )}
            {imagePreview && <img className="av-announce-preview-image" src={imagePreview} alt="attachment preview" />}
          </div>
        </section>
      </div>
    </div>
  );
}
