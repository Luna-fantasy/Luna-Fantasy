'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminGet, adminPut } from '@/lib/admin/http';
import { useToast } from '../../_components/Toast';
import { useFocusTrap } from '../../_components/a11y';
import { getAdminPortalTarget } from '../../_components/portal-root';

interface PassportDto {
  number?: string;
  fullName?: string;
  dateOfBirth?: string;
  faction?: string;
  issuedAt?: number;
  issuedBy?: string;
  originalNumber?: string;
  staffRole?: string;
}

interface PassportGetResponse {
  passport: PassportDto | null;
  factions: string[];
  numberPattern: string;
}

interface Props {
  discordId: string;
  displayName: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const DOB_RE = /^\d{2}\/\d{2}$/;

export default function PassportDialog({ discordId, displayName, onClose, onSaved }: Props) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  const [factions, setFactions] = useState<string[]>([]);
  const [numberPattern, setNumberPattern] = useState<string>('');
  const [staffFields, setStaffFields] = useState<Pick<PassportDto, 'originalNumber' | 'staffRole'>>({});
  const [issued, setIssued] = useState<Pick<PassportDto, 'issuedAt' | 'issuedBy'>>({});

  const [number, setNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [faction, setFaction] = useState('');

  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, true, handleEscape);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminGet<PassportGetResponse>(`/api/admin/users/${discordId}/passport`);
        if (cancelled) return;
        setFactions(res.factions ?? []);
        setNumberPattern(res.numberPattern ?? '');
        if (res.passport) {
          setIsEdit(true);
          setNumber(res.passport.number ?? '');
          setFullName(res.passport.fullName ?? '');
          setDateOfBirth(res.passport.dateOfBirth ?? '');
          setFaction(res.passport.faction ?? '');
          setStaffFields({
            ...(res.passport.originalNumber ? { originalNumber: res.passport.originalNumber } : {}),
            ...(res.passport.staffRole ? { staffRole: res.passport.staffRole } : {}),
          });
          setIssued({
            ...(res.passport.issuedAt ? { issuedAt: res.passport.issuedAt } : {}),
            ...(res.passport.issuedBy ? { issuedBy: res.passport.issuedBy } : {}),
          });
        }
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [discordId]);

  const normalizedNumber = number.trim().toUpperCase();
  // numberPattern comes from the route's own validator (already ^...$-anchored)
  const numberValid = (() => {
    if (!normalizedNumber) return false;
    if (!numberPattern) return true;
    try {
      const src = numberPattern.startsWith('^') ? numberPattern : `^(?:${numberPattern})$`;
      return new RegExp(src).test(normalizedNumber);
    } catch {
      return true; // malformed pattern from server — let the server validate
    }
  })();
  const dobDigits = dateOfBirth.trim();
  const dobFormatOk = DOB_RE.test(dobDigits);
  const dobRangeOk = (() => {
    if (!dobFormatOk) return false;
    const [dd, mm] = dobDigits.split('/').map((s) => parseInt(s, 10));
    return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12;
  })();
  const nameOk = fullName.trim().length >= 1 && fullName.trim().length <= 80;
  const factionOk = factions.includes(faction);
  const canSave = !loading && !busy && numberValid && dobRangeOk && nameOk && factionOk;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const res = await adminPut<{ success: boolean; roleGranted?: boolean }>(
        `/api/admin/users/${discordId}/passport`,
        {
          number: normalizedNumber,
          fullName: fullName.trim(),
          dateOfBirth: dobDigits,
          faction,
          ...issued,
          ...staffFields,
        },
      );
      toast.show({ tone: 'success', title: isEdit ? 'Passport updated' : 'Passport issued', message: normalizedNumber });
      if (res.roleGranted === false) {
        toast.show({ tone: 'error', title: 'Role grant failed', message: 'Profile saved, but the Discord passport role could not be granted.' });
      }
      await onSaved();
      onClose();
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const portalTarget = getAdminPortalTarget();
  if (!portalTarget) return null;
  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={handleEscape} />
      <div ref={dialogRef} className="av-moddialog" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Passport' : 'Issue Passport'}>
        <header>
          <div>
            <h3>{isEdit ? 'Edit Passport' : 'Issue Passport'}</h3>
            <p>Lunar citizenship papers <span className="av-moddialog-target">for {displayName}</span></p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="av-moddialog-body">
          {loading && <p style={{ opacity: 0.7 }}>Consulting the registry…</p>}
          {loadError && (
            <div className="av-moddialog-warn"><strong>Failed to load passport.</strong> {loadError}</div>
          )}
          {!loading && !loadError && (
            <>
              {staffFields.staffRole && (
                <div className="av-moddialog-warn">
                  <strong>Staff passport: {staffFields.staffRole.toUpperCase()}.</strong>{' '}
                  Managed by role automation — the staff tier and original number are preserved automatically.
                </div>
              )}
              <label className="av-moddialog-field">
                <span>Passport number</span>
                <input
                  className="av-audit-input"
                  placeholder="LUNA-110317#####"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  autoFocus
                />
                {number !== '' && !numberValid && (
                  <span style={{ color: 'var(--accent-danger, #ff6b6b)', fontSize: 12 }}>
                    Must be LUNA-110317##### or GUARDIAN / SENTINEL / MASTERMIND
                  </span>
                )}
              </label>
              <label className="av-moddialog-field">
                <span>Full name</span>
                <input
                  className="av-audit-input"
                  placeholder="Citizen's registered name"
                  value={fullName}
                  maxLength={80}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="av-moddialog-field">
                <span>Date of birth <strong>·</strong> DD/MM</span>
                <input
                  className="av-audit-input"
                  placeholder="17/03"
                  value={dateOfBirth}
                  maxLength={5}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
                {dateOfBirth !== '' && !dobRangeOk && (
                  <span style={{ color: 'var(--accent-danger, #ff6b6b)', fontSize: 12 }}>
                    Use DD/MM — day 01–31, month 01–12
                  </span>
                )}
              </label>
              <label className="av-moddialog-field">
                <span>Faction</span>
                <select
                  className="av-audit-input"
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                >
                  <option value="" disabled>Choose a faction…</option>
                  {factions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={!canSave}>
            {busy ? 'Sealing…' : isEdit ? 'Save changes' : 'Issue passport'}
          </button>
        </footer>
      </div>
    </>,
    portalTarget
  );
}
