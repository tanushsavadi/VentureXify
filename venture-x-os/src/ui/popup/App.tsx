import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import '../styles/globals.css';

export default function PopupApp() {
  const [enabled, setEnabled] = useState(true);
  const [tipCount, setTipCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTOPILOT_STATE' });
      if (response) {
        setEnabled(response.enabled);
        setTipCount(response.tipHistory?.length || 0);
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutopilot = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    await chrome.runtime.sendMessage({ 
      type: 'TOGGLE_AUTOPILOT', 
      payload: { enabled: newEnabled } 
    });
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  };

  if (loading) {
    return (
      <div className="w-80 p-6 bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-80 bg-surface-50 dark:bg-surface-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-surface-800 to-surface-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg">VentureXify</h1>
            <p className="text-xs text-white/60">Autopilot Mode</p>
          </div>
        </div>
      </div>
      
      {/* Status */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between p-3 bg-white dark:bg-surface-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-3 h-3 rounded-full',
              enabled ? 'bg-emerald-500 animate-pulse' : 'bg-surface-400'
            )} />
            <span className="font-medium text-surface-900 dark:text-white">
              {enabled ? 'Autopilot Active' : 'Autopilot Paused'}
            </span>
          </div>
          <button
            onClick={toggleAutopilot}
            className={clsx(
              'relative w-12 h-6 rounded-full transition-colors duration-200',
              enabled ? 'bg-accent-500' : 'bg-surface-300 dark:bg-surface-600'
            )}
            role="switch"
            aria-checked={enabled}
          >
            <motion.div
              className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ x: enabled ? 24 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        
        {tipCount > 0 && (
          <div className="text-center text-sm text-surface-500">
            {tipCount} tips generated this session
          </div>
        )}
        
        {/* Open Side Panel */}
        <button
          onClick={openSidePanel}
          className="w-full py-3 rounded-xl bg-accent-500 text-white font-semibold hover:bg-accent-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7"/>
          </svg>
          Open Full Dashboard
        </button>
        
        {/* Quick Info */}
        <div className="text-xs text-surface-400 text-center">
          Browse travel sites for smart recommendations
        </div>
      </div>
    </div>
  );
}
