'use client';

import { useState, useEffect } from 'react';
import AdminLightbox from '../components/AdminLightbox';
import { getCsrfToken } from '../utils/csrf';
import type { CanvasTypeDef } from '@/lib/admin/canvas-definitions';

interface Channel {
  id: string;
  name: string;
  parentName: string;
}

interface TestDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  definition: CanvasTypeDef;
  bot: 'butler' | 'jester';
  onSaveFirst: () => Promise<boolean>;
  hasUnsavedChanges: boolean;
}

type Status = 'idle' | 'saving' | 'sending' | 'waiting' | 'done' | 'error' | 'timeout';

export default function TestDeployModal({
  isOpen, onClose, definition, bot, onSaveFirst, hasUnsavedChanges,
}: TestDeployModalProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [messageUrl, setMessageUrl] = useState('');
  const [errorText, setErrorText] = useState('');

  // Load channels when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setMessageUrl('');
    setErrorText('');

    if (channels.length > 0) return;
    setLoadingChannels(true);
    fetch('/api/admin/announce')
      .then(r => r.json())
      .then(data => {
        setChannels(data.channels ?? []);
        setLoadingChannels(false);
      })
      .catch(() => setLoadingChannels(false));
  }, [isOpen, channels.length]);

  // Group channels by category
  const grouped: Record<string, Channel[]> = {};
  for (const ch of channels) {
    (grouped[ch.parentName] ??= []).push(ch);
  }

  async function handleSend() {
    if (!selectedChannel) return;

    try {
      // Save layout first if there are unsaved changes
      if (hasUnsavedChanges) {
        setStatus('saving');
        const ok = await onSaveFirst();
        if (!ok) {
          setStatus('error');
          setErrorText('Failed to save layout. Fix errors and try again.');
          return;
        }
      }

      setStatus('sending');
      const res = await fetch('/api/admin/canvas/test-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          canvasType: definition.id,
          channelId: selectedChannel,
          bot,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setStatus('waiting');
      const data = await res.json();

      if (data.messageUrl) {
        setStatus('done');
        setMessageUrl(data.messageUrl);
      } else if (data.error === 'timeout') {
        setStatus('timeout');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorText(err.message || 'Test deploy failed');
    }
  }

  const statusMessages: Record<Status, string> = {
    idle: '',
    saving: 'Saving layout...',
    sending: 'Creating test request...',
    waiting: 'Waiting for bot to render...',
    done: 'Preview sent to Discord!',
    error: errorText,
    timeout: 'Timed out. The bot may be offline or busy.',
  };

  return (
    <AdminLightbox isOpen={isOpen} onClose={onClose} title="Test Deploy" size="sm">
      <div style={{ padding: '0 20px 20px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          Render <strong>{definition.label}</strong> with sample data using the actual bot and send it to a Discord channel.
        </p>

        {/* Channel selector */}
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          Channel
        </label>
        <select
          className="admin-form-input"
          value={selectedChannel}
          onChange={e => setSelectedChannel(e.target.value)}
          disabled={status !== 'idle' && status !== 'error' && status !== 'timeout'}
          style={{ fontSize: 13, marginBottom: 12 }}
        >
          <option value="">
            {loadingChannels ? 'Loading channels...' : 'Select a channel'}
          </option>
          {Object.entries(grouped).map(([category, chs]) => (
            <optgroup key={category} label={category}>
              {chs.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {hasUnsavedChanges && status === 'idle' && (
          <p style={{ fontSize: 11, color: '#d29922', margin: '0 0 8px' }}>
            Layout has unsaved changes — they will be saved automatically before testing.
          </p>
        )}

        {/* Status */}
        {status !== 'idle' && (
          <div style={{
            fontSize: 12, padding: '8px 10px', borderRadius: 6, marginBottom: 12,
            background: status === 'done' ? 'rgba(63,185,80,.1)' : status === 'error' || status === 'timeout' ? 'rgba(248,81,73,.1)' : 'rgba(88,166,255,.1)',
            color: status === 'done' ? '#3fb950' : status === 'error' || status === 'timeout' ? '#f85149' : '#58a6ff',
          }}>
            {statusMessages[status]}
            {status === 'done' && messageUrl && (
              <a
                href={messageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 8, color: '#58a6ff', textDecoration: 'underline' }}
              >
                View in Discord
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {(status === 'idle' || status === 'error' || status === 'timeout') && (
            <button
              className="admin-btn admin-btn-primary admin-btn-sm"
              onClick={handleSend}
              disabled={!selectedChannel}
            >
              Send Test
            </button>
          )}
          {(status === 'saving' || status === 'sending' || status === 'waiting') && (
            <button className="admin-btn admin-btn-primary admin-btn-sm" disabled>
              {status === 'waiting' ? 'Waiting...' : 'Sending...'}
            </button>
          )}
        </div>
      </div>
    </AdminLightbox>
  );
}
