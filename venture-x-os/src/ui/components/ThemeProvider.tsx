import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getPreferences, setPreferences, onPreferencesChange } from '@/lib/storage';

type Theme = 'light' | 'dark' | 'oled' | 'system';
type ResolvedTheme = 'light' | 'dark' | 'oled';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove('light', 'dark', 'oled');
  
  // Add the appropriate class
  root.classList.add(resolvedTheme);
  
  // Update color-scheme for native UI elements
  if (resolvedTheme === 'light') {
    root.style.colorScheme = 'light';
  } else {
    root.style.colorScheme = 'dark';
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme('system'));
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const prefs = await getPreferences();
        setThemeState(prefs.theme);
        const resolved = resolveTheme(prefs.theme);
        setResolvedTheme(resolved);
        applyTheme(resolved);
      } catch (error) {
        console.error('Failed to load theme:', error);
        applyTheme('light');
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      applyTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Listen for storage changes (sync across tabs/windows)
  useEffect(() => {
    const unsubscribe = onPreferencesChange((changes) => {
      if (changes.preferences?.newValue?.theme) {
        const newTheme = changes.preferences.newValue.theme as Theme;
        setThemeState(newTheme);
        const resolved = resolveTheme(newTheme);
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    });
    return unsubscribe;
  }, []);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    
    try {
      await setPreferences({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  // Apply theme immediately during initial load to prevent flash
  useEffect(() => {
    if (isLoading) {
      // Try to get theme from storage synchronously for faster initial paint
      applyTheme(resolvedTheme);
    }
  }, [isLoading, resolvedTheme]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
