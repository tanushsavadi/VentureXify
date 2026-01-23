/**
 * useUserPrefs Hook
 * 
 * React hook for managing user preferences reactively.
 * Loads from storage, provides setter, and listens for changes.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getUserPrefs,
  setUserPrefs,
  needsOnboarding,
  type UserPrefs,
  DEFAULT_USER_PREFS,
  onPrefsChange,
} from '../../storage/userPrefs';

export interface UseUserPrefsReturn {
  prefs: UserPrefs;
  isLoading: boolean;
  needsOnboarding: boolean;
  updatePref: <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => Promise<void>;
  updatePrefs: (partial: Partial<UserPrefs>) => Promise<void>;
  reload: () => Promise<void>;
}

export function useUserPrefs(): UseUserPrefsReturn {
  const [prefs, setLocalPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Load preferences on mount
  useEffect(() => {
    loadPrefs();
    
    // Listen for external changes
    const unsubscribe = onPrefsChange((newPrefs) => {
      setLocalPrefs(newPrefs);
    });
    
    return unsubscribe;
  }, []);
  
  const loadPrefs = async () => {
    setIsLoading(true);
    try {
      const [loaded, needs] = await Promise.all([
        getUserPrefs(),
        needsOnboarding(),
      ]);
      setLocalPrefs(loaded);
      setShowOnboarding(needs);
    } catch (error) {
      console.error('[useUserPrefs] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updatePref = useCallback(async <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    try {
      await setUserPrefs({ [key]: value });
      // Local state will be updated via onPrefsChange listener
    } catch (error) {
      console.error('[useUserPrefs] Failed to update:', error);
    }
  }, []);
  
  const updatePrefs = useCallback(async (partial: Partial<UserPrefs>) => {
    try {
      await setUserPrefs(partial);
      // Local state will be updated via onPrefsChange listener
    } catch (error) {
      console.error('[useUserPrefs] Failed to update:', error);
    }
  }, []);
  
  const reload = useCallback(async () => {
    await loadPrefs();
  }, []);
  
  return {
    prefs,
    isLoading,
    needsOnboarding: showOnboarding,
    updatePref,
    updatePrefs,
    reload,
  };
}

export default useUserPrefs;
