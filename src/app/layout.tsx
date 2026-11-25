import { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { lunaBrandIcons } from '@/lib/luna-brand';
import '@/styles/globals.css';
import '@/styles/notifications.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LocalizedDocument } from '@/components/LocalizedDocument';

type Props = {
  children: ReactNode;
};

export const metadata: Metadata = { icons: lunaBrandIcons };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#080808',
};

export default function RootLayout({ children }: Props) {
  return (
    <LocalizedDocument>
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
    </LocalizedDocument>
  );
}
