"use client";

import { SWRConfig } from 'swr';
import api from '@/lib/api';

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SWRConfig 
      value={{
        fetcher: (url: string) => api.get(url, { timeout: 60000 }).then(res => res.data),
        revalidateOnFocus: true,
        revalidateIfStale: true,
        dedupingInterval: 2000,
        errorRetryCount: 5,
        errorRetryInterval: 3000,
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Don't retry on 401/403/404
          if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 404) return;
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s  
          const delay = Math.min(3000 * Math.pow(2, retryCount), 60000);
          setTimeout(() => revalidate({ retryCount }), delay);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
};
