'use client';

import { ArchiveName } from '@/components/ArchiveName';
import React, { useEffect, useId, useRef, useState } from 'react';
import { lunaSecretCodexLabels, type LunaSecretCodexSelection } from '@/lib/cinematic/luna-secret-codex';
import { LunaSecretCodexReading } from './LunaSecretCodexReading';
import styles from './luna-secret-codex-viewer.module.css';

type Props = {
  selection: LunaSecretCodexSelection;
  onClose: () => void;
  openerElement?: HTMLElement;
};

/** Public viewer only, mounted in lieu of (never alongside) the ordinary inspector. */
export function LunaSecretCodexViewer({ selection, onClose, openerElement }: Props) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const labelId = useId();
  const [rejectedPreferred, setRejectedPreferred] = useState<string>();
  const [rejectedDetail, setRejectedDetail] = useState<string>();
  const { releaseId, artwork, reading } = selection;
  const preferred = artwork.preferred !== rejectedPreferred ? artwork.preferred : undefined;
  const displayed = preferred ?? (artwork.detail !== rejectedDetail ? artwork.detail : undefined);
  const ui = lunaSecretCodexLabels[reading.lang];

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const savedOverflow = document.body.style.overflow;
    const opener = openerElement?.isConnected ? openerElement : document.activeElement;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    const handlePageHide = () => {
      if (modal.open) modal.close();
      document.body.style.overflow = savedOverflow;
      closeHandler.current();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (modal.open) modal.close();
      document.body.style.overflow = savedOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll:true });
    };
  }, [openerElement]);

  return (
    <dialog
      ref={modalRef}
      className={styles.viewer}
      aria-labelledby={labelId}
      lang={reading.lang}
      dir={reading.lang === 'ar' ? 'rtl' : 'ltr'}
      data-secret-codex={releaseId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.content}>
        <header className={styles.bar}>
          <h2 id={labelId}><ArchiveName>{reading.name}</ArchiveName></h2>
          <button type="button" onClick={onClose} autoFocus>{ui.close}</button>
        </header>
        <figure className={styles.face}>
          {displayed ? (
            // Only same-ID approved local variants are ever considered by the viewer.
            // An eager, unoptimized image avoids recoding the verified file in the inspector.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayed}
              alt={reading.name}
              onError={() => {
                if (preferred) setRejectedPreferred(preferred);
                else setRejectedDetail(artwork.detail);
              }}
            />
          ) : (
            <p role="status">{ui.unavailable}</p>
          )}
        </figure>
        <LunaSecretCodexReading key={releaseId} className={styles.reading} selection={selection} />
      </div>
    </dialog>
  );
}
