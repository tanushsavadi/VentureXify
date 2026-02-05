'use client';

import { WaitlistProvider } from '@/context/WaitlistContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WaitlistProvider>
      {children}
    </WaitlistProvider>
  );
}
