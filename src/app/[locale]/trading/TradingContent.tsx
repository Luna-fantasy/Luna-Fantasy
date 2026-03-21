'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { onBalanceUpdate, dispatchBalanceUpdate } from '@/lib/balance-events';

const PRESET_AMOUNTS = [5_000, 10_000, 25_000, 50_000];
const MAX_AMOUNT = 50_000;
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function getCsrfToken(): string {
  const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

function formatCountdown(ms: number, t: ReturnType<typeof useTranslations>): string {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}${t('hours')}`);
  if (m > 0) parts.push(`${m}${t('minutes')}`);
  if (h === 0) parts.push(`${s}${t('seconds')}`);
  return parts.join(' ');
}

type TradeResult = {
  won: boolean;
  delta: number;
  newBalance: number;
  amount: number;
} | null;

export default function TradingContent() {
  const { data: session } = useSession();
  const t = useTranslations('tradingPage');
  const isLoggedIn = !!session?.user;

  const [balance, setBalance] = useState<number | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult>(null);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownText, setCooldownText] = useState('');
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch trade status
  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch('/api/bank/trade');
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        if (data.onCooldown && data.nextTradeAt) {
          setCooldownEnd(data.nextTradeAt);
        } else {
          setCooldownEnd(null);
        }
      }
    } catch {}
  }, [isLoggedIn]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    return onBalanceUpdate((b) => setBalance(b));
  }, []);

  // Cooldown ticker
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!cooldownEnd) {
      setCooldownText('');
      return;
    }

    const tick = () => {
      const remaining = cooldownEnd - Date.now();
      if (remaining <= 0) {
        setCooldownEnd(null);
        setCooldownText('');
      } else {
        setCooldownText(formatCountdown(remaining, t));
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldownEnd, t]);

  const tradeAmount = isCustom
    ? parseInt(customAmount, 10) || 0
    : selectedAmount ?? 0;

  const canTrade =
    isLoggedIn &&
    !loading &&
    !cooldownEnd &&
    tradeAmount > 0 &&
    tradeAmount <= MAX_AMOUNT &&
    balance !== null &&
    tradeAmount <= balance;

  const handleTrade = async () => {
    if (!canTrade) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/bank/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ amount: tradeAmount }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          won: data.won,
          delta: data.delta,
          newBalance: data.newBalance,
          amount: data.amount,
        });
        setBalance(data.newBalance);
        dispatchBalanceUpdate(data.newBalance);
        if (data.nextTradeAt) {
          setCooldownEnd(data.nextTradeAt);
        }
      } else if (res.status === 429 && data.nextTradeAt) {
        setCooldownEnd(data.nextTradeAt);
        setError(data.error);
      } else {
        setError(data.error || 'Trade failed');
      }
    } catch {
      setError('Network error');
    }

    setLoading(false);
  };

  const handlePlayAgain = () => {
    setResult(null);
    setSelectedAmount(null);
    setCustomAmount('');
    setIsCustom(false);
  };

  const selectPreset = (amount: number) => {
    setIsCustom(false);
    setSelectedAmount(amount === selectedAmount ? null : amount);
    setError('');
    setResult(null);
  };

  const toggleCustom = () => {
    setIsCustom(!isCustom);
    setSelectedAmount(null);
    setError('');
    setResult(null);
  };

  return (
    <div className="trading-page">
      {/* Hero */}
      <div className="trading-hero">
        <div className="trading-hero-bg">
          <EImg editId="trading-hero-bg" source="r2" src="https://assets.lunarian.app/backgrounds/BankHero.png" alt="Trading" fill priority className="trading-hero-bg-image" />
        </div>
        <div className="trading-hero-content">
          <h1 className="trading-hero-title"><E ns="tradingPage" k="title">{t('title')}</E></h1>
          <p className="trading-hero-desc"><E ns="tradingPage" k="subtitle">{t('subtitle')}</E></p>
        </div>
      </div>

      <div className="trading-wrap">
        {/* Stats overview */}
        <div className="trading-stats-bar">
          <div className="trading-stat-item">
            <span className="trading-stat-label"><E ns="tradingPage" k="maxTrade">{t('maxTrade')}</E></span>
            <span className="trading-stat-value accent">50,000</span>
          </div>
          <div className="trading-stat-item">
            <span className="trading-stat-label"><E ns="tradingPage" k="winChance">{t('winChance')}</E></span>
            <span className="trading-stat-value win">50%</span>
          </div>
          <div className="trading-stat-item">
            <span className="trading-stat-label"><E ns="tradingPage" k="winReward">{t('winReward')}</E></span>
            <span className="trading-stat-value win">+20%</span>
          </div>
          <div className="trading-stat-item">
            <span className="trading-stat-label"><E ns="tradingPage" k="lossPenalty">{t('lossPenalty')}</E></span>
            <span className="trading-stat-value loss">-30%</span>
          </div>
          <div className="trading-stat-item">
            <span className="trading-stat-label"><E ns="tradingPage" k="cooldown">{t('cooldown')}</E></span>
            <span className="trading-stat-value muted">4<E ns="tradingPage" k="hours">{t('hours')}</E></span>
          </div>
        </div>

        {/* Warning */}
        <div className="trading-warning-bar">
          <span className="trading-warning-icon">!</span>
          <span className="trading-warning-text"><E ns="tradingPage" k="warning">{t('warning')}</E></span>
        </div>

        {!isLoggedIn ? (
          /* Signed-out state */
          <div className="trading-signed-out">
            <p><E ns="tradingPage" k="signInRequired">{t('signInRequired')}</E></p>
            <button className="trading-sign-in-btn" onClick={() => signIn('discord')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <E ns="tradingPage" k="signIn">{t('signIn')}</E>
            </button>
          </div>
        ) : result ? (
          /* Result state */
          <div className={`trading-result ${result.won ? 'win' : 'loss'}`}>
            <div className="trading-result-icon">{result.won ? '✦' : '✧'}</div>
            <div className="trading-result-text">
              {result.won
                ? t('resultWin', { amount: Math.abs(result.delta).toLocaleString() })
                : t('resultLoss', { amount: Math.abs(result.delta).toLocaleString() })}
            </div>
            <div className="trading-result-balance">
              <span className="trading-result-balance-label"><E ns="tradingPage" k="newBalance">{t('newBalance')}</E></span>
              <span className="trading-result-balance-value">{result.newBalance.toLocaleString()}</span>
            </div>
            {!cooldownEnd && (
              <button className="trading-action-btn" onClick={handlePlayAgain}>
                <E ns="tradingPage" k="playAgain">{t('playAgain')}</E>
              </button>
            )}
            {cooldownEnd && cooldownText && (
              <div className="trading-cooldown-notice">
                {t('cooldownRemaining', { time: cooldownText })}
              </div>
            )}
          </div>
        ) : (
          /* Trading interface */
          <div className="trading-interface">
            {/* Balance */}
            {balance !== null && (
              <div className="trading-balance">
                <span className="trading-balance-label"><E ns="tradingPage" k="balance">{t('balance')}</E></span>
                <span className="trading-balance-value">
                  {balance.toLocaleString()} <span className="trading-balance-currency"><E ns="tradingPage" k="currency">{t('currency')}</E></span>
                </span>
              </div>
            )}

            {/* Cooldown */}
            {cooldownEnd && cooldownText && (
              <div className="trading-cooldown-bar">
                <span className="trading-cooldown-icon">⏳</span>
                <span>{t('cooldownRemaining', { time: cooldownText })}</span>
              </div>
            )}

            {/* Amount selector */}
            <div className="trading-amount-section">
              <div className="trading-amount-title"><E ns="tradingPage" k="selectAmount">{t('selectAmount')}</E></div>
              <div className="trading-presets">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    className={`trading-preset-btn ${!isCustom && selectedAmount === amount ? 'selected' : ''}`}
                    onClick={() => selectPreset(amount)}
                    disabled={!!cooldownEnd}
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
                <button
                  className={`trading-preset-btn custom-btn ${isCustom ? 'selected' : ''}`}
                  onClick={toggleCustom}
                  disabled={!!cooldownEnd}
                >
                  <E ns="tradingPage" k="custom">{t('custom')}</E>
                </button>
              </div>

              {isCustom && (
                <div className="trading-custom-input-wrap">
                  <input
                    type="number"
                    className="trading-custom-input"
                    placeholder={t('customPlaceholder')}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min={1}
                    max={MAX_AMOUNT}
                    disabled={!!cooldownEnd}
                  />
                </div>
              )}

              {/* Preview */}
              {tradeAmount > 0 && (
                <div className="trading-preview">
                  <div className="trading-preview-row win">
                    <span><E ns="tradingPage" k="winReward">{t('winReward')}</E></span>
                    <span>+{Math.floor(tradeAmount * 0.2).toLocaleString()}</span>
                  </div>
                  <div className="trading-preview-row loss">
                    <span><E ns="tradingPage" k="lossPenalty">{t('lossPenalty')}</E></span>
                    <span>-{Math.floor(tradeAmount * 0.3).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="trading-error">{error}</div>
            )}

            {/* Trade button */}
            <button
              className={`trading-action-btn ${loading ? 'loading' : ''}`}
              onClick={handleTrade}
              disabled={!canTrade}
            >
              {loading ? t('trading') : cooldownEnd ? t('onCooldown') : t('trade')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
