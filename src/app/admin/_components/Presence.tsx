'use client';

import { useEffect, useState } from 'react';

/**
 * Presence — lightweight "who's here" dots via BroadcastChannel.
 * Works across tabs in the same browser (same user, multi-window).
 * Real multi-admin presence would need a Pusher/Redis pub/sub backend.
 * This is a foundation that upgrades cleanly to a server channel later.
 */

interface Peer {
  id: string;
  name: string;
  lastSeen: number;
}

interface PresenceProps {
  room: string;        // unique key per page, e.g. `user:123456`
  self: { id: string; name: string };
}

const STALE_MS = 15_000;
const PING_MS = 4_000;

export default function Presence({ room, self }: PresenceProps) {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel(`av-presence:${room}`);

    const sendPing = () => ch.postMessage({ t: 'ping', peer: { ...self, lastSeen: Date.now() } });

    ch.onmessage = (e: MessageEvent) => {
      const { t, peer } = e.data || {};
      if (t === 'ping' && peer) {
        setPeers((prev) => {
          const next = prev.filter((p) => p.id !== peer.id);
          next.push(peer);
          return next;
        });
        if (peer.id !== self.id) {
          ch.postMessage({ t: 'pong', peer: { ...self, lastSeen: Date.now() } });
        }
      } else if (t === 'pong' && peer) {
        setPeers((prev) => {
          const next = prev.filter((p) => p.id !== peer.id);
          next.push(peer);
          return next;
        });
      } else if (t === 'leave' && peer) {
        setPeers((prev) => prev.filter((p) => p.id !== peer.id));
      }
    };

    sendPing();
    const pingTimer = window.setInterval(sendPing, PING_MS);
    const reapTimer = window.setInterval(() => {
      setPeers((prev) => prev.filter((p) => Date.now() - p.lastSeen < STALE_MS));
    }, PING_MS);

    const onUnload = () => {
      try { ch.postMessage({ t: 'leave', peer: { ...self, lastSeen: Date.now() } }); } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.clearInterval(pingTimer);
      window.clearInterval(reapTimer);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
      ch.close();
    };
  }, [room, self.id, self.name]);

  const others = peers.filter((p) => p.id !== self.id);
  if (others.length === 0) return null;

  return (
    <div className="av-presence" title={`${others.length} other viewer${others.length === 1 ? '' : 's'}`}>
      {others.slice(0, 4).map((p) => (
        <span key={p.id} className="av-presence-dot" title={p.name}>
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {others.length > 4 && <span className="av-presence-more">+{others.length - 4}</span>}
    </div>
  );
}
