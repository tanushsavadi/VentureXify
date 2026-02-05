'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getWaitlistCount } from '@/lib/supabase';

interface WaitlistContextType {
  isSignedUp: boolean;
  userEmail: string | null;
  signupSource: string | null;
  position: number | null;
  waitlistCount: number;
  setSignedUp: (email: string, source: string, position?: number) => void;
  incrementWaitlistCount: () => void;
  refreshWaitlistCount: () => Promise<void>;
}

const WaitlistContext = createContext<WaitlistContextType | undefined>(undefined);

const STORAGE_KEY = 'venturexify_waitlist_signup';

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signupSource, setSignupSource] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [waitlistCount, setWaitlistCount] = useState(0);

  // Check localStorage on mount for persisted signup state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setIsSignedUp(true);
        setUserEmail(data.email || null);
        setSignupSource(data.source || null);
        setPosition(data.position || null);
      }
    } catch {
      // localStorage not available or invalid data
    }
  }, []);

  // Fetch initial waitlist count
  useEffect(() => {
    getWaitlistCount().then(setWaitlistCount);
  }, []);

  const setSignedUp = useCallback((email: string, source: string, pos?: number) => {
    setIsSignedUp(true);
    setUserEmail(email);
    setSignupSource(source);
    if (pos) setPosition(pos);
    
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        email, 
        source, 
        position: pos,
        timestamp: Date.now() 
      }));
    } catch {
      // localStorage not available
    }
  }, []);

  const incrementWaitlistCount = useCallback(() => {
    setWaitlistCount(prev => prev + 1);
  }, []);

  const refreshWaitlistCount = useCallback(async () => {
    const count = await getWaitlistCount();
    setWaitlistCount(count);
  }, []);

  return (
    <WaitlistContext.Provider value={{ 
      isSignedUp, 
      userEmail, 
      signupSource, 
      position,
      waitlistCount,
      setSignedUp, 
      incrementWaitlistCount,
      refreshWaitlistCount 
    }}>
      {children}
    </WaitlistContext.Provider>
  );
}

export function useWaitlist() {
  const context = useContext(WaitlistContext);
  if (context === undefined) {
    throw new Error('useWaitlist must be used within a WaitlistProvider');
  }
  return context;
}
