import { ReactNode } from 'react';
import type { Viewport } from 'next';
import '@/styles/globals.css';
import '@/styles/notifications.css';
import { AuthProvider } from '@/components/AuthProvider';

type Props = {
  children: ReactNode;
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0a12',
};

export default function RootLayout({ children }: Props) {
  return (
    <html suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Cinzel:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
