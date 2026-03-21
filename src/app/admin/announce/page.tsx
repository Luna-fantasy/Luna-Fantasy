'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';

interface Channel {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string;
  position: number;
}

interface GroupedChannels {
  category: string;
  channels: Channel[];
}

interface ServerEmoji {
  id: string;
  name: string;
  animated: boolean;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function AnnouncePage() {
  const { toast } = useToast();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [grouped, setGrouped] = useState<GroupedChannels[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [serverEmojis, setServerEmojis] = useState<ServerEmoji[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announce');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch channels');
      }
      const data = await res.json();
      const chs: Channel[] = data.channels ?? [];
      setChannels(chs);
      if (data.emojis) setServerEmojis(data.emojis);

      // Group by category
      const map = new Map<string, Channel[]>();
      for (const ch of chs) {
        const cat = ch.parentName;
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(ch);
      }
      const groups: GroupedChannels[] = [];
      map.forEach((channels, category) => {
        groups.push({ category, channels });
      });
      groups.sort((a, b) => a.category.localeCompare(b.category));
      setGrouped(groups);
    } catch (err: any) {
      toast(err.message || 'Failed to load channels', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Handle image selection
  function handleImageSelect(file: File | null) {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast('Only image files are allowed', 'error');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast('Image must be under 8MB', 'error');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Send announcement
  async function handleSend() {
    if (!selectedChannel) {
      toast('Select a channel first', 'error');
      return;
    }
    if (!content.trim()) {
      toast('Write a message first', 'error');
      return;
    }

    setSending(true);
    try {
      let imageData: string | undefined;
      let imageType: string | undefined;

      if (imageFile) {
        const buffer = await imageFile.arrayBuffer();
        imageData = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        imageType = imageFile.type;
      }

      const res = await fetch('/api/admin/announce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          channelId: selectedChannel,
          content: content.trim(),
          ...(imageData ? { imageData, imageType } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send announcement');
      }

      const channelName = channels.find((c) => c.id === selectedChannel)?.name ?? selectedChannel;
      toast(`Announcement sent to #${channelName}`, 'success');

      // Clear form
      setContent('');
      removeImage();
      if (textareaRef.current) textareaRef.current.focus();
    } catch (err: any) {
      toast(err.message || 'Failed to send announcement', 'error');
    } finally {
      setSending(false);
    }
  }

  // Keyboard shortcut: Ctrl+Enter to send
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const selectedChannelName = channels.find((c) => c.id === selectedChannel)?.name;

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">📢</span> Announce</h1>
          <p className="admin-page-subtitle">Send announcements via Oracle bot</p>
        </div>
        <div className="admin-empty"><p>Loading channels...</p></div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">📢</span> Announce</h1>
        <p className="admin-page-subtitle">Send announcements to Discord channels via Oracle bot</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left column: Compose */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 className="admin-card-title" style={{ margin: 0 }}>Compose</h3>

          {/* Channel selector */}
          <div className="admin-form-group">
            <label className="admin-form-label">📺 Channel</label>
            <p className="admin-form-description">Select the Discord channel to post the announcement in</p>
            <select
              className="admin-form-input"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select a channel...</option>
              {grouped.map((group) => (
                <optgroup key={group.category} label={group.category.toUpperCase()}>
                  {group.channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Message textarea */}
          <div className="admin-form-group">
            <label className="admin-form-label">
              📝 Message
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '8px', fontSize: '12px' }}>
                {content.length}/4000 — Supports Discord markdown
              </span>
            </label>
            <textarea
              ref={textareaRef}
              className="admin-form-input"
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 4000) setContent(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Write your announcement..."
              rows={10}
              style={{
                resize: 'vertical',
                minHeight: '200px',
                fontFamily: 'inherit',
                lineHeight: '1.6',
              }}
            />
            {/* Emoji picker */}
            <div style={{ position: 'relative', marginTop: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ fontSize: 13, padding: '4px 12px' }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {showEmojiPicker ? 'Close Emojis' : 'Server Emojis'}
              </button>
              {showEmojiPicker && serverEmojis.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                  borderRadius: 12, padding: 12, zIndex: 50, width: 340, maxHeight: 260,
                  overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                    Server Emojis ({serverEmojis.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {serverEmojis.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        title={`:${e.name}:`}
                        onClick={() => {
                          const tag = e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
                          const ta = textareaRef.current;
                          if (ta) {
                            const start = ta.selectionStart;
                            const before = content.substring(0, start);
                            const after = content.substring(ta.selectionEnd);
                            const newContent = before + tag + after;
                            if (newContent.length <= 4000) {
                              setContent(newContent);
                              setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + tag.length; ta.focus(); }, 0);
                            }
                          } else {
                            if ((content + tag).length <= 4000) setContent(content + tag);
                          }
                        }}
                        style={{
                          width: 36, height: 36, padding: 2, cursor: 'pointer',
                          background: 'transparent', border: '1px solid transparent',
                          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(ev) => { (ev.target as HTMLElement).style.background = 'rgba(0,212,255,0.1)'; (ev.target as HTMLElement).style.borderColor = 'rgba(0,212,255,0.3)'; }}
                        onMouseLeave={(ev) => { (ev.target as HTMLElement).style.background = 'transparent'; (ev.target as HTMLElement).style.borderColor = 'transparent'; }}
                      >
                        <img
                          src={`https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'webp'}?size=32`}
                          alt={e.name}
                          width={28}
                          height={28}
                          style={{ objectFit: 'contain' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image upload */}
          <div className="admin-form-group">
            <label className="admin-form-label">🖼️ Image (optional)</label>
            {imagePreview ? (
              <div style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
              }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    margin: '0 auto',
                  }}
                />
                <button
                  onClick={removeImage}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    lineHeight: 1,
                  }}
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                  borderRadius: '8px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                  background: dragOver ? 'rgba(99, 135, 255, 0.05)' : 'transparent',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: 'var(--text-tertiary)' }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>
                  Click or drag an image here
                </p>
                <p style={{ color: 'var(--text-tertiary)', margin: '4px 0 0', fontSize: '12px' }}>
                  PNG, JPG, GIF, WebP up to 8MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
          </div>

          {/* Send button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleSend}
              disabled={sending || !selectedChannel || !content.trim()}
              style={{
                padding: '12px 32px',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {sending ? (
                <>
                  <span className="admin-spinner" style={{ width: '16px', height: '16px' }} />
                  Sending...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: '16px', height: '16px' }}
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  📨 Send Announcement
                </>
              )}
            </button>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Ctrl+Enter to send
            </span>
          </div>
        </div>

        {/* Right column: Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="admin-card-title" style={{ margin: 0 }}>Preview</h3>

            {!content.trim() && !imagePreview ? (
              <div className="admin-empty" style={{ padding: '40px 16px' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>Start typing to see a preview</p>
              </div>
            ) : (
              <div style={{
                background: '#2b2d31',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #3f4147',
              }}>
                {/* Discord-like message container */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  {/* Bot avatar */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #5865f2, #3b42c4)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}>
                    O
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Bot name + timestamp */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#5865f2', fontWeight: 600, fontSize: '15px' }}>
                        Luna Oracle
                      </span>
                      <span style={{
                        background: '#5865f2',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}>
                        BOT
                      </span>
                      <span style={{ color: '#949ba4', fontSize: '12px' }}>
                        Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message content */}
                    <div style={{
                      color: '#dbdee1',
                      fontSize: '14px',
                      lineHeight: '1.375rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {content || ''}
                    </div>

                    {/* Image preview */}
                    {imagePreview && (
                      <div style={{ marginTop: '8px' }}>
                        <img
                          src={imagePreview}
                          alt="Attachment"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedChannelName && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: 0 }}>
                Will be sent to <strong style={{ color: 'var(--text-secondary)' }}>#{selectedChannelName}</strong>
              </p>
            )}
          </div>

          {/* Channel info card */}
          <div className="admin-card">
            <h3 className="admin-card-title" style={{ margin: '0 0 12px' }}>Available Channels</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {grouped.map((group) => (
                <div key={group.category} style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                  }}>
                    {group.category}
                  </div>
                  {group.channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChannel(ch.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: selectedChannel === ch.id ? 'rgba(99, 135, 255, 0.15)' : 'transparent',
                        color: selectedChannel === ch.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedChannel !== ch.id) {
                          (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedChannel !== ch.id) {
                          (e.target as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      # {ch.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack columns on smaller screens */}
      <style>{`
        @media (max-width: 900px) {
          .admin-card:first-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </>
  );
}
