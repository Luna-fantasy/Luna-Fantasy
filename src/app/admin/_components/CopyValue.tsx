'use client';

import { useToast } from './Toast';
import type { ReactNode } from 'react';

interface CopyValueProps {
  value: string | number;
  label?: string;
  children: ReactNode;
}

export default function CopyValue({ value, label = 'value', children }: CopyValueProps) {
  const toast = useToast();
  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(String(value));
      toast.push(`Copied ${label}: ${value}`, 'success', 1800);
    } catch {
      toast.push('Copy failed', 'err', 2200);
    }
  };
  return (
    <button type="button" className="av-copy-value" onClick={onClick} title={`Click to copy: ${value}`}>
      {children}
    </button>
  );
}
