'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
interface DailyClaimCardProps {
  lastClaimed: number | null;
  isVip: boolean;
  onClaim: () => Promise<void>;
  disabled?: boolean;
  dailyBase?: number;
  vipBonus?: number;
  cooldownMs?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function DailyClaimCard({ lastClaimed, isVip, onClaim, disabled, dailyBase, vipBonus, cooldownMs }: DailyClaimCardProps) {
  const t = useTranslations('bankPage');

  const DAILY_BASE_DEFAULT = 3_000;
  const DAILY_VIP_BONUS_DEFAULT = 2_000;
  const DAILY_COOLDOWN_DEFAULT = 86_400_000;
  const base = dailyBase ?? DAILY_BASE_DEFAULT;
  const bonus = vipBonus ?? DAILY_VIP_BONUS_DEFAULT;
  const cooldown = cooldownMs ?? DAILY_COOLDOWN_DEFAULT;
  const [remaining, setRemaining] = useState(0);
  const [claiming, setClaiming] = useState(false);

  const calcRemaining = useCallback(() => {
    if (!lastClaimed) return 0;
    const elapsed = Date.now() - lastClaimed;
    return Math.max(0, cooldown - elapsed);
  }, [lastClaimed, cooldown]);

  useEffect(() => {
    setRemaining(calcRemaining());
    const interval = setInterval(() => {
      const r = calcRemaining();
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1_000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  const onCooldown = remaining > 0;

  const handleClaim = async () => {
    if (onCooldown || claiming || disabled) return;
    setClaiming(true);
    try {
      await onClaim();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="salary-card daily-claim-card">
      <div className="salary-card-header">
        <span className="salary-card-title">{t('salary.daily.title')}</span>
        {onCooldown && (
          <div className="salary-timer">
            <span className="timer-icon"></span>
            <span>{formatCountdown(remaining)}</span>
          </div>
        )}
      </div>
      <p className="salary-desc">{t('salary.daily.desc')}</p>
      <div className="salary-amount">
        <span className="salary-value">{base.toLocaleString('en-US')}</span>
        <span className="salary-currency">{t('currency')}</span>
      </div>
      {isVip && (
        <div className="salary-bonus">
          <span className="bonus-icon">+</span>
          <span>{t('salary.daily.vipBonus')}: +{bonus.toLocaleString('en-US')} {t('currency')}</span>
        </div>
      )}
      {!isVip && (
        <p className="vip-note">
          {t('salary.daily.vipNote')}{' '}
          <a href="#investment" className="vip-note-link">{t('dashboard.depositNow')}</a>
        </p>
      )}
      <button
        className={`section-action-btn daily-claim-btn ${onCooldown ? 'on-cooldown' : ''} ${!onCooldown && !disabled ? 'ready' : ''}`}
        onClick={handleClaim}
        disabled={onCooldown || claiming || disabled}
      >
        {claiming
          ? t('dashboard.claiming')
          : onCooldown
            ? formatCountdown(remaining)
            : t('salary.daily.claimBtn')}
      </button>
    </div>
  );
}
