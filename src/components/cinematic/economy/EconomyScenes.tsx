'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { useEditMode } from '@/lib/edit-mode/context';
import { mountBazaarMotion } from './bazaar-motion';
import { mountMerchantPress } from './merchant-press';
import { mountMerchantCraft } from './merchant-craft';
import { mountMerchantStory } from './merchant-story';
import { mountBankArt } from './bank-motion';
import { mountEconomyCards } from './economy-card-motion';
import { useMerchantEntry } from './shelf-navigation';
import './economy-scenes.css';
import './economy-card-motion.css';

export type MerchantScene = 'kael' | 'meluna' | 'zoldar' | 'seluna' | 'brimor' | 'mells';
type BazaarScene = MerchantScene | 'hub';

export function BazaarTrack({ scene, enabled = true, children }: { scene: BazaarScene; enabled?: boolean; children: ReactNode }) {
  const { editMode } = useEditMode();
  if (!enabled || editMode) return <>{children}</>;
  return <div className="v3-bazaar-track" data-scene={scene}>{children}</div>;
}

export function BazaarOverlay({ scene, enabled = true }: { scene: BazaarScene; enabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { editMode } = useEditMode();
  useMerchantEntry(enabled && !editMode && scene !== 'hub');
  useEffect(() => {
    if (!enabled || editMode || !host.current) return;
    const releaseScene = mountBazaarMotion(host.current, scene);
    const releaseCards = mountEconomyCards(host.current.closest('main'), scene);
    return () => { releaseCards?.(); releaseScene?.(); };
  }, [enabled, editMode, scene]);
  return enabled && !editMode ? <div ref={host} className="v3-bazaar-motion" aria-hidden="true" /> : null;
}

export function MerchantSequence({ merchant }: { merchant: MerchantScene }) {
  const host = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  useEffect(() => {
    if (!host.current) return;
    if (merchant === 'kael' || merchant === 'zoldar') return mountMerchantPress(host.current, merchant, locale);
    if (merchant === 'meluna' || merchant === 'brimor') return mountMerchantCraft(host.current, merchant);
    return mountMerchantStory(host.current, merchant, locale);
  }, [locale, merchant]);
  return <div ref={host} className="merchant-sequence-host" data-merchant-sequence={merchant} />;
}

export function BankArt({ role }: { role: 'vault' | 'ledger' | 'seal' }) {
  const host = useRef<HTMLDivElement>(null);
  const { editMode } = useEditMode();
  useEffect(() => {
    if (editMode || !host.current) return;
    const releaseArt = mountBankArt(host.current, role);
    const releaseCards = role === 'vault' ? mountEconomyCards(host.current.closest('main'), 'bank') : undefined;
    return () => { releaseCards?.(); releaseArt?.(); };
  }, [editMode, role]);
  return editMode ? null : <div ref={host} className={'v3-bank-art v3-bank-' + role} aria-hidden="true" />;
}
