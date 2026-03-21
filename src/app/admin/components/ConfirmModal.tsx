'use client';

import { useEffect, useRef } from 'react';
import AdminLightbox from './AdminLightbox';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <AdminLightbox isOpen={true} onClose={onCancel} size="sm">
      <div role="alertdialog" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-message">
        <h3 className="admin-modal-title" id="confirm-modal-title">{title}</h3>
        <p className="admin-modal-message" id="confirm-modal-message">{message}</p>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`admin-btn ${variant === 'danger' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AdminLightbox>
  );
}
