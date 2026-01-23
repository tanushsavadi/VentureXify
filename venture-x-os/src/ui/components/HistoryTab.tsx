// ============================================
// COMPARISON HISTORY TAB
// ============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { getComparisonResults, getCompareSessions, clearCompareSessions } from '@/lib/compareStorage';
import { ComparisonResult, CompareSession, formatPrice, timeAgo } from '@/lib/compareTypes';
import type { ConfidenceLevel } from '@/lib/types';

// ============================================
// TYPES
// ============================================

interface HistoryItem {
  session: CompareSession;
  result: ComparisonResult | null;
}

// ============================================
// CONFIDENCE BADGE
// ============================================

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  MED: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
  LOW: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
};

// ============================================
// SHARE HELPERS
// ============================================

/**
 * Generate a shareable summary string from a comparison result
 */
function generateShareSummary(result: ComparisonResult): string {
  const winnerEmoji = result.winner === 'portal' ? '🏪' : result.winner === 'direct' ? '✈️' : '🤝';
  const winnerLabel = result.winner === 'portal' ? 'Portal' : result.winner === 'direct' ? 'Direct' : 'Tie';
  
  const lines = [
    `**VentureXify Comparison**`,
    ``,
    `${result.itinerarySummary || 'Travel booking'}`,
    ``,
    `💰 Portal: $${result.portalPrice.toFixed(0)} (${result.portalPointsEarned.toLocaleString()} pts)`,
    `✈️ Direct: $${result.directPrice.toFixed(0)} (${result.directPointsEarned.toLocaleString()} pts)`,
    ``,
    `${winnerEmoji} **Winner: ${winnerLabel}** ${result.delta !== 0 ? `(${result.delta > 0 ? '+' : ''}$${result.delta.toFixed(0)} difference)` : ''}`,
    ``,
    `Net advantage: $${Math.abs(result.netDifference).toFixed(0)}`,
    `Confidence: ${result.confidence}`,
    ``,
    `---`,
    `*Calculated by VentureXify Chrome Extension*`,
  ];
  
  return lines.join('\n');
}

/**
 * Copy comparison summary to clipboard
 */
function handleCopySummary(result: ComparisonResult): void {
  const summary = generateShareSummary(result);
  navigator.clipboard.writeText(summary).then(() => {
    // Could add a toast notification here
    console.log('[HistoryTab] Summary copied to clipboard');
  }).catch((err) => {
    console.error('[HistoryTab] Failed to copy:', err);
  });
}

/**
 * Share to Reddit by opening a new post with pre-filled content
 */
function handleShareToReddit(result: ComparisonResult): void {
  const summary = generateShareSummary(result);
  const subreddit = 'VentureX';
  const title = encodeURIComponent(`Portal vs Direct comparison: ${result.itinerarySummary || 'Travel booking'}`);
  const text = encodeURIComponent(summary);
  
  // Open Reddit submit page with pre-filled content
  const url = `https://www.reddit.com/r/${subreddit}/submit?type=TEXT&title=${title}&text=${text}`;
  window.open(url, '_blank');
}

// ============================================
// HISTORY ITEM CARD
// ============================================

interface HistoryItemCardProps {
  item: HistoryItem;
  onClick: () => void;
}

function HistoryItemCard({ item, onClick }: HistoryItemCardProps) {
  const { session, result } = item;
  
  const winnerIcon = result
    ? result.winner === 'portal'
      ? '🏪'
      : result.winner === 'direct'
      ? '✈️'
      : '🤝'
    : session.status === 'FAILED' ? '❌' : '⏳';
  
  const statusLabel = session.status === 'DONE' 
    ? (result?.winner === 'portal' ? 'Portal Won' : result?.winner === 'direct' ? 'Direct Won' : 'Tie')
    : session.status === 'FAILED'
    ? 'Failed'
    : 'In Progress';
  
  const statusColor = session.status === 'DONE'
    ? result?.winner === 'portal' ? 'text-yellow-500' : result?.winner === 'direct' ? 'text-blue-500' : 'text-gray-500'
    : session.status === 'FAILED'
    ? 'text-red-500'
    : 'text-gray-400';

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:border-accent-400 dark:hover:border-accent-500 transition-all"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{winnerIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={clsx('text-sm font-medium', statusColor)}>
              {statusLabel}
            </span>
            {result && (
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-full',
                CONFIDENCE_STYLES[result.confidence].bg,
                CONFIDENCE_STYLES[result.confidence].text
              )}>
                {result.confidence}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-400 mt-1">
            {timeAgo(session.createdAt)}
          </p>
        </div>
      </div>
      
      {/* Itinerary Summary */}
      {result?.itinerarySummary && (
        <p className="text-sm text-surface-600 dark:text-surface-300 mb-3 truncate">
          {result.itinerarySummary}
        </p>
      )}
      
      {/* Price Comparison */}
      {result && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-500 mb-1">Portal</p>
            <p className="font-semibold text-surface-900 dark:text-white">
              {formatPrice(result.portalPrice)}
            </p>
          </div>
          <div className="p-2 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-500 mb-1">Direct</p>
            <p className="font-semibold text-surface-900 dark:text-white">
              {formatPrice(result.directPrice)}
            </p>
          </div>
          <div className="p-2 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-500 mb-1">Delta</p>
            <p className={clsx(
              'font-semibold',
              result.delta > 0 ? 'text-red-500' : result.delta < 0 ? 'text-green-500' : 'text-gray-500'
            )}>
              {result.delta >= 0 ? '+' : ''}{formatPrice(result.delta)}
            </p>
          </div>
        </div>
      )}
      
      {/* Provider */}
      {result?.providerName && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-xs text-surface-400">
            Provider: {result.providerName}
          </p>
        </div>
      )}
    </motion.button>
  );
}

// ============================================
// HISTORY DETAIL MODAL
// ============================================

interface HistoryDetailModalProps {
  item: HistoryItem;
  onClose: () => void;
}

function HistoryDetailModal({ item, onClose }: HistoryDetailModalProps) {
  const { session, result } = item;
  
  if (!result) return null;
  
  const winnerLabel = result.winner === 'portal'
    ? '🏆 Portal Won'
    : result.winner === 'direct'
    ? '🏆 Direct Won'
    : '🤝 Tie';
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-surface-800 rounded-2xl p-5 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-surface-900 dark:text-white">
            {winnerLabel}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Itinerary */}
        {result.itinerarySummary && (
          <div className="mb-4 p-3 bg-surface-50 dark:bg-surface-900 rounded-xl">
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              {result.itinerarySummary}
            </p>
            {result.providerName && (
              <p className="text-xs text-surface-500 mt-1">
                {result.providerName}
              </p>
            )}
          </div>
        )}
        
        {/* Price Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Portal Price</p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {formatPrice(result.portalPrice)}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {result.portalPointsEarned.toLocaleString()} pts earned
            </p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Direct Price</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatPrice(result.directPrice)}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {result.directPointsEarned.toLocaleString()} pts earned
            </p>
          </div>
        </div>
        
        {/* Key Stats */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <span className="text-sm text-surface-600 dark:text-surface-400">Difference</span>
            <span className={clsx(
              'font-semibold',
              result.delta > 0 ? 'text-red-500' : result.delta < 0 ? 'text-green-500' : 'text-gray-500'
            )}>
              {result.delta >= 0 ? '+' : ''}{formatPrice(result.delta)} ({result.deltaPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="flex justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <span className="text-sm text-surface-600 dark:text-surface-400">Net Advantage</span>
            <span className="font-semibold text-surface-900 dark:text-white">
              {formatPrice(result.netDifference)}
            </span>
          </div>
          <div className="flex justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <span className="text-sm text-surface-600 dark:text-surface-400">Break-even Premium</span>
            <span className="font-semibold text-surface-900 dark:text-white">
              {formatPrice(result.breakEvenPremium)}
            </span>
          </div>
          <div className="flex justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
            <span className="text-sm text-surface-600 dark:text-surface-400">Confidence</span>
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              CONFIDENCE_STYLES[result.confidence].bg,
              CONFIDENCE_STYLES[result.confidence].text
            )}>
              {result.confidence}
            </span>
          </div>
        </div>
        
        {/* Notes */}
        {result.notes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Notes</h4>
            <ul className="space-y-1">
              {result.notes.map((note, idx) => (
                <li key={idx} className="text-sm text-surface-600 dark:text-surface-400 flex items-start gap-2">
                  <span className="text-surface-400">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Assumptions */}
        {result.assumptions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Assumptions</h4>
            <ul className="space-y-1">
              {result.assumptions.map((assumption, idx) => (
                <li key={idx} className="text-sm text-surface-600 dark:text-surface-400 flex items-start gap-2">
                  <span className="text-accent-500">•</span>
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Timestamps */}
        <div className="text-xs text-surface-400 pt-3 border-t border-surface-100 dark:border-surface-700">
          <p>Compared: {new Date(result.createdAt).toLocaleString()}</p>
          <p>Portal captured: {timeAgo(result.portalCapturedAt)}</p>
          <p>Direct captured: {timeAgo(result.directCapturedAt)}</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleCopySummary(result)}
            className="flex-1 py-3 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl font-medium hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
          <button
            onClick={() => handleShareToReddit(result)}
            className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
            Share to Reddit
          </button>
        </div>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-2 w-full py-3 bg-accent-500 text-white rounded-xl font-medium hover:bg-accent-600 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN HISTORY TAB
// ============================================

export function HistoryTab() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  
  useEffect(() => {
    loadHistory();
  }, []);
  
  const loadHistory = async () => {
    setLoading(true);
    try {
      const sessions = await getCompareSessions();
      const results = await getComparisonResults();
      
      // Map sessions to history items
      const items: HistoryItem[] = sessions.map((session) => ({
        session,
        result: results.find((r) => r.sessionId === session.id) || null,
      }));
      
      // Sort by creation time (newest first)
      items.sort((a, b) => b.session.createdAt - a.session.createdAt);
      
      setHistory(items);
    } catch (error) {
      console.error('[HistoryTab] Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearHistory = async () => {
    try {
      await clearCompareSessions();
      setHistory([]);
      setConfirmClear(false);
    } catch (error) {
      console.error('[HistoryTab] Error clearing history:', error);
    }
  };
  
  // Stats
  const completedCount = history.filter((h) => h.session.status === 'DONE').length;
  const portalWins = history.filter((h) => h.result?.winner === 'portal').length;
  const directWins = history.filter((h) => h.result?.winner === 'direct').length;
  const totalSavings = history.reduce((sum, h) => {
    if (h.result && h.result.winner === 'portal' && h.result.delta < 0) {
      return sum + Math.abs(h.result.delta);
    }
    if (h.result && h.result.winner === 'direct' && h.result.delta > 0) {
      return sum + h.result.delta;
    }
    return sum;
  }, 0);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-surface-900 dark:text-white">
          Comparison History
        </h2>
        {history.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      
      {/* Stats Summary */}
      {history.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 bg-surface-50 dark:bg-surface-800 rounded-xl text-center">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{completedCount}</p>
            <p className="text-xs text-surface-500">Compared</p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{portalWins}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">Portal</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{directWins}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Direct</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${Math.round(totalSavings)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">Saved</p>
          </div>
        </div>
      )}
      
      {/* History List */}
      {history.length > 0 ? (
        <div className="space-y-3">
          {history.map((item) => (
            <HistoryItemCard
              key={item.session.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-semibold text-surface-900 dark:text-white mb-2">
            No comparisons yet
          </h3>
          <p className="text-sm text-surface-500 max-w-xs mx-auto">
            Compare portal vs direct prices on Capital One Travel to see your history here
          </p>
        </div>
      )}
      
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && selectedItem.result && (
          <HistoryDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {confirmClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmClear(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-surface-800 rounded-2xl p-5 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg text-surface-900 dark:text-white">
                  Clear History?
                </h3>
                <p className="text-sm text-surface-500 mt-1">
                  This will delete all {history.length} comparison{history.length !== 1 ? 's' : ''}. This cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 py-3 bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl font-medium hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearHistory}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default HistoryTab;
