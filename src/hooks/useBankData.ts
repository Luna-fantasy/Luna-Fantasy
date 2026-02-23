'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BankDashboardData } from '@/types/bank';

interface UseBankDataReturn {
  data: BankDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBankData(): UseBankDataReturn {
  const [data, setData] = useState<BankDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bank/dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          setData(null);
          return;
        }
        throw new Error(`Failed to fetch bank data (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
