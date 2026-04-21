'use client';

import { useEffect, useState } from 'react';

interface Peer {
  id: string;
  name: string;
  lastSeen: number;
}

interface Props {
  room: string;
  self: { id: string; name: string };
}

const STALE_MS = 15_000;
const PING_MS = 4_000;

/**
 * PresencePill — topbar-pill showing live admin-tab count.
 * Uses BroadcastChannel for same-browser multi-tab presence.
 * Hidden when only the current tab is present.
 */
export default function PresencePill({ room, self }: Props) {
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

  // Include self in the count (peers already contains self after first ping)
  const uniqueIds = new Set(peers.map((p) => p.id));
  uniqueIds.add(self.id);
  const count = uniqueIds.size;

  if (count <= 1) return null;

  return (
    <span
      className="av-topbar-pill av-presence-pill"
      title={`${count} admin tabs open`}
      data-count={count}
    >
      <span className="av-pulse" />
      <span>{count} tabs</span>
    </span>
  );
}
