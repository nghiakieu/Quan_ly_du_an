"use client";

import { SWRConfig } from 'swr';
import api from '@/lib/api';

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SWRConfig 
      value={{
        fetcher: (url: string) => api.get(url).then(res => res.data),
        revalidateOnFocus: true,
        revalidateIfStale: true,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
};
