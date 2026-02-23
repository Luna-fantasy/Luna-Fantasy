'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { CardSwap } from '@/types/marketplace';
import SwapOfferCard from './SwapOfferCard';
import SwapProposalModal from './SwapProposalModal';
import CounterOfferModal from './CounterOfferModal';

interface SwapsTabProps {
  onStatusMsg: (msg: { type: 'success' | 'error'; text: string }) => void;
}

type SubTab = 'incoming' | 'outgoing' | 'history';

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

export default function SwapsTab({ onStatusMsg }: SwapsTabProps) {
  const t = useTranslations('swapsPage');
  const [subTab, setSubTab] = useState<SubTab>('incoming');
  const [incoming, setIncoming] = useState<CardSwap[]>([]);
  const [outgoing, setOutgoing] = useState<CardSwap[]>([]);
  const [history, setHistory] = useState<CardSwap[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [counteringSwap, setCounteringSwap] = useState<CardSwap | null>(null);

  const fetchSwaps = useCallback(async (tab: SubTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/swaps/${tab}`);
      if (res.ok) {
        const data = await res.json();
        const swaps = data.swaps || [];
        if (tab === 'incoming') setIncoming(swaps);
        else if (tab === 'outgoing') setOutgoing(swaps);
        else setHistory(swaps);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSwaps(subTab);
  }, [subTab, fetchSwaps]);

  const handleAccept = async (swapId: string) => {
    try {
      const res = await fetch('/api/swaps/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ swapId }),
      });
      if (res.ok) {
        onStatusMsg({ type: 'success', text: t('acceptSuccess') });
        fetchSwaps('incoming');
      } else {
        const data = await res.json();
        onStatusMsg({ type: 'error', text: data.error || t('acceptError') });
      }
    } catch {
      onStatusMsg({ type: 'error', text: t('acceptError') });
    }
  };

  const handleDecline = async (swapId: string) => {
    try {
      const res = await fetch('/api/swaps/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ swapId }),
      });
      if (res.ok) {
        onStatusMsg({ type: 'success', text: t('declineSuccess') });
        fetchSwaps('incoming');
      } else {
        const data = await res.json();
        onStatusMsg({ type: 'error', text: data.error || t('declineError') });
      }
    } catch {
      onStatusMsg({ type: 'error', text: t('declineError') });
    }
  };

  const handleCancel = async (swapId: string) => {
    try {
      const res = await fetch('/api/swaps/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ swapId }),
      });
      if (res.ok) {
        onStatusMsg({ type: 'success', text: t('cancelSuccess') });
        fetchSwaps('outgoing');
      } else {
        const data = await res.json();
        onStatusMsg({ type: 'error', text: data.error || t('cancelError') });
      }
    } catch {
      onStatusMsg({ type: 'error', text: t('cancelError') });
    }
  };

  const handleCounterCreated = () => {
    setCounteringSwap(null);
    onStatusMsg({ type: 'success', text: t('counterSuccess') });
    fetchSwaps('incoming');
    fetchSwaps('outgoing');
  };

  const handleProposalCreated = () => {
    setShowProposal(false);
    onStatusMsg({ type: 'success', text: t('proposeSuccess') });
    fetchSwaps('outgoing');
    setSubTab('outgoing');
  };

  const currentSwaps = subTab === 'incoming' ? incoming : subTab === 'outgoing' ? outgoing : history;

  return (
    <div className="swaps-tab">
      {/* Sub-tabs */}
      <div className="swaps-sub-tabs">
        <button
          className={`swaps-sub-tab ${subTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setSubTab('incoming')}
        >
          {t('incoming')}
          {incoming.length > 0 && <span className="swaps-sub-tab-count">{incoming.length}</span>}
        </button>
        <button
          className={`swaps-sub-tab ${subTab === 'outgoing' ? 'active' : ''}`}
          onClick={() => setSubTab('outgoing')}
        >
          {t('outgoing')}
        </button>
        <button
          className={`swaps-sub-tab ${subTab === 'history' ? 'active' : ''}`}
          onClick={() => setSubTab('history')}
        >
          {t('history')}
        </button>
        <button className="swaps-propose-btn" onClick={() => setShowProposal(true)}>
          {t('proposeSwap')}
        </button>
      </div>

      {/* Swap list */}
      {loading ? (
        <div className="swaps-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 12 }} />
          ))}
        </div>
      ) : currentSwaps.length === 0 ? (
        <div className="marketplace-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <p>{t(`empty.${subTab}` as any)}</p>
        </div>
      ) : (
        <div className="swaps-list">
          {currentSwaps.map((swap) => (
            <SwapOfferCard
              key={swap.swapId}
              swap={swap}
              perspective={subTab}
              onAccept={() => handleAccept(swap.swapId)}
              onDecline={() => handleDecline(swap.swapId)}
              onCancel={() => handleCancel(swap.swapId)}
              onCounter={() => setCounteringSwap(swap)}
            />
          ))}
        </div>
      )}

      {/* Proposal modal */}
      {showProposal && (
        <SwapProposalModal
          onClose={() => setShowProposal(false)}
          onCreated={handleProposalCreated}
        />
      )}

      {/* Counter-offer modal */}
      {counteringSwap && (
        <CounterOfferModal
          originalSwap={counteringSwap}
          onClose={() => setCounteringSwap(null)}
          onCreated={handleCounterCreated}
        />
      )}
    </div>
  );
}
