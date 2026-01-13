'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check for saved language preference
    const savedLang = localStorage.getItem('luna-lang') || 'en';
    router.replace(`/${savedLang}`);
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#030306',
      color: '#fff'
    }}>
      <p>Loading...</p>
    </div>
  );
}
