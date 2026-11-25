'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { documentLocaleForPath } from '@/lib/document-locale';

export function LocalizedDocument({ children }: { children: ReactNode }) {
  const locale = documentLocaleForPath(usePathname());
  return <html {...locale} suppressHydrationWarning>{children}</html>;
}
