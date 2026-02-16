// ============================================
// EXTRACTION CONFIDENCE UI COMPONENTS
// ============================================
// React components for displaying extraction confidence
// and handling low-confidence capture scenarios

import React, { useState, useCallback } from 'react';
import type { Confidence, CandidateScore, Evidence } from '../../../lib/extraction/types';

// ============================================
// CONFIDENCE BADGE
// ============================================

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const confidenceConfig: Record<Confidence, { 
  color: string; 
  bgColor: string; 
  label: string;
  icon: string;
}> = {
  HIGH: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'High Confidence',
    icon: '✓',
  },
  MEDIUM: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Medium Confidence',
    icon: '~',
  },
  LOW: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Low Confidence',
    icon: '!',
  },
  NONE: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Not Detected',
    icon: '✗',
  },
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function ConfidenceBadge({ 
  confidence, 
  showLabel = false,
  size = 'sm',
  className = ''
}: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.color} ${config.bgColor} ${sizeClasses[size]}
        ${className}
      `}
      title={config.label}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{confidence}</span>}
    </span>
  );
}

// ============================================
// FIX CAPTURE BUTTON
// ============================================

export interface FixCaptureButtonProps {
  onFix: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function FixCaptureButton({ 
  onFix, 
  disabled = false,
  loading = false,
  className = ''
}: FixCaptureButtonProps) {
  return (
    <button
      onClick={onFix}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5
        text-sm font-medium text-[#2d6ba6]
        bg-[#e8f0f8] hover:bg-[#d0e2f0]
        rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? (
        <>
          <span className="animate-spin">⟳</span>
          <span>Fixing...</span>
        </>
      ) : (
        <>
          <span>🎯</span>
          <span>Fix Capture</span>
        </>
      )}
    </button>
  );
}

// ============================================
// CANDIDATE LIST (for debugging)
// ============================================

export interface CandidateListProps {
  candidates: CandidateScore[];
  maxVisible?: number;
  className?: string;
}

export function CandidateList({ 
  candidates, 
  maxVisible = 5,
  className = ''
}: CandidateListProps) {
  const [expanded, setExpanded] = useState(false);
  
  const visibleCandidates = expanded 
    ? candidates 
    : candidates.slice(0, maxVisible);
  
  if (candidates.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No price candidates found
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        What we saw ({candidates.length} candidates)
      </div>
      
      <div className="space-y-1">
        {visibleCandidates.map((candidate, index) => (
          <CandidateItem key={index} candidate={candidate} rank={index + 1} />
        ))}
      </div>
      
      {candidates.length > maxVisible && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-[#2d6ba6] hover:text-[#13202e]"
        >
          Show {candidates.length - maxVisible} more...
        </button>
      )}
    </div>
  );
}

interface CandidateItemProps {
  candidate: CandidateScore;
  rank: number;
}

function CandidateItem({ candidate, rank }: CandidateItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const scoreColor = candidate.score >= 70 
    ? 'text-emerald-600' 
    : candidate.score >= 40 
      ? 'text-amber-600' 
      : 'text-gray-500';
  
  return (
    <div className="text-sm">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="text-gray-400 text-xs w-4">{rank}.</span>
        <span className="flex-1 truncate font-mono text-xs">
          {candidate.text}
        </span>
        <span className="font-medium">
          ${candidate.value.toFixed(2)}
        </span>
        <span className={`text-xs font-medium ${scoreColor}`}>
          {candidate.score}
        </span>
      </div>
      
      {showDetails && (
        <div className="ml-6 mt-1 text-xs text-gray-500 space-y-0.5">
          {candidate.reasons.map((reason: string, i: number) => (
            <div key={i} className="text-emerald-600">{reason}</div>
          ))}
          {candidate.penalties?.map((penalty: string, i: number) => (
            <div key={i} className="text-red-500">{penalty}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// LOW CONFIDENCE PROMPT
// ============================================

export interface LowConfidencePromptProps {
  confidence: Confidence;
  evidence: Evidence;
  onFix: () => void;
  onDismiss: () => void;
  onReport?: () => void;
  className?: string;
}

export function LowConfidencePrompt({
  confidence,
  evidence,
  onFix,
  onDismiss,
  onReport,
  className = '',
}: LowConfidencePromptProps) {
  const isNone = confidence === 'NONE';
  
  return (
    <div className={`
      rounded-lg border p-4 
      ${isNone ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}
      ${className}
    `}>
      <div className="flex items-start gap-3">
        <div className={`
          text-2xl
          ${isNone ? 'text-red-500' : 'text-amber-500'}
        `}>
          {isNone ? '⚠️' : '🔍'}
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="font-medium text-gray-900">
            {isNone 
              ? "Couldn't detect the price"
              : "Price detection needs verification"
            }
          </div>
          
          <div className="text-sm text-gray-600">
            {isNone 
              ? "We couldn't confidently find a total price on this page. Help us by clicking on the price element."
              : "We found a price but aren't certain it's the total. Please verify or help us find the correct element."
            }
          </div>
          
          {evidence.warnings && evidence.warnings.length > 0 && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Note: </span>
              {evidence.warnings.join(', ')}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onFix}
              className={`
                px-4 py-2 rounded-lg font-medium text-sm
                ${isNone 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                }
              `}
            >
              🎯 Click to Select Price
            </button>
            
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-lg font-medium text-sm text-gray-600 hover:bg-gray-100"
            >
              Dismiss
            </button>
            
            {onReport && (
              <button
                onClick={onReport}
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                Report Issue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXTRACTION STATUS INDICATOR
// ============================================

export interface ExtractionStatusProps {
  status: 'idle' | 'extracting' | 'success' | 'lowConfidence' | 'failed';
  confidence?: Confidence;
  amount?: number;
  currency?: string;
  tiersAttempted?: number;
  onRetry?: () => void;
  onFix?: () => void;
  className?: string;
}

export function ExtractionStatus({
  status,
  confidence,
  amount,
  currency,
  tiersAttempted,
  onRetry,
  onFix,
  className = '',
}: ExtractionStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'extracting': return '⟳';
      case 'success': return '✓';
      case 'lowConfidence': return '!';
      case 'failed': return '✗';
      default: return '○';
    }
  };
  
  const getStatusColor = () => {
    switch (status) {
      case 'extracting': return 'text-blue-600';
      case 'success': return 'text-emerald-600';
      case 'lowConfidence': return 'text-amber-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`${status === 'extracting' ? 'animate-spin' : ''} ${getStatusColor()}`}>
        {getStatusIcon()}
      </span>
      
      {status === 'success' && amount !== undefined && (
        <>
          <span className="font-semibold">
            {currency}{amount.toFixed(2)}
          </span>
          {confidence && <ConfidenceBadge confidence={confidence} size="sm" />}
        </>
      )}
      
      {status === 'extracting' && (
        <span className="text-sm text-gray-500">
          Detecting price{tiersAttempted ? ` (${tiersAttempted} methods)` : '...'}
        </span>
      )}
      
      {status === 'lowConfidence' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-amber-600">Needs verification</span>
          {onFix && (
            <button 
              onClick={onFix}
              className="text-xs text-[#2d6ba6] hover:text-[#13202e]"
            >
              Fix
            </button>
          )}
        </div>
      )}
      
      {status === 'failed' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-600">Detection failed</span>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="text-xs text-[#2d6ba6] hover:text-[#13202e]"
            >
              Retry
            </button>
          )}
          {onFix && (
            <button 
              onClick={onFix}
              className="text-xs text-[#2d6ba6] hover:text-[#13202e]"
            >
              Manual
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// DEBUG PANEL (for development)
// ============================================

export interface DebugPanelProps {
  evidence: Evidence;
  tiersAttempted?: number[];
  successfulTier?: number;
  latencyMs?: number;
  onCopyDebug?: () => void;
  className?: string;
}

export function DebugPanel({
  evidence,
  tiersAttempted,
  successfulTier,
  latencyMs,
  onCopyDebug,
  className = '',
}: DebugPanelProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`
      rounded-lg border border-gray-200 bg-gray-50 text-xs
      ${className}
    `}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100"
      >
        <span className="font-medium text-gray-600">
          Debug Info
        </span>
        <span className="text-gray-400">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <div>
              <span className="text-gray-400">Selector: </span>
              <span className="font-mono">{evidence.selector || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Latency: </span>
              <span>{latencyMs?.toFixed(1)}ms</span>
            </div>
            <div>
              <span className="text-gray-400">Tiers: </span>
              <span>{tiersAttempted?.join(', ') || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400">Success: </span>
              <span>Tier {successfulTier || 'N/A'}</span>
            </div>
          </div>
          
          {evidence.domPath && (
            <div>
              <span className="text-gray-400">DOM Path: </span>
              <span className="font-mono text-gray-600 break-all">
                {evidence.domPath}
              </span>
            </div>
          )}
          
          {evidence.labelsNearby && evidence.labelsNearby.length > 0 && (
            <div>
              <span className="text-gray-400">Labels: </span>
              <span className="text-gray-600">
                {evidence.labelsNearby.join(', ')}
              </span>
            </div>
          )}
          
          {evidence.candidateScores && evidence.candidateScores.length > 0 && (
            <CandidateList 
              candidates={evidence.candidateScores} 
              maxVisible={3}
            />
          )}
          
          {onCopyDebug && (
            <button
              onClick={onCopyDebug}
              className="mt-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
            >
              📋 Copy Debug Payload
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PRICE DISPLAY WITH CONFIDENCE
// ============================================

export interface PriceWithConfidenceProps {
  amount: number;
  currency: string;
  confidence: Confidence;
  perNight?: boolean;
  isFromPrice?: boolean;
  onFix?: () => void;
  className?: string;
}

export function PriceWithConfidence({
  amount,
  currency,
  confidence,
  perNight = false,
  isFromPrice = false,
  onFix,
  className = '',
}: PriceWithConfidenceProps) {
  const needsFix = confidence === 'LOW' || confidence === 'NONE';
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-baseline gap-1">
        {isFromPrice && (
          <span className="text-xs text-gray-500">from</span>
        )}
        <span className="text-lg font-bold">
          {currency}{amount.toFixed(2)}
        </span>
        {perNight && (
          <span className="text-xs text-gray-500">/night</span>
        )}
      </div>
      
      <ConfidenceBadge confidence={confidence} />
      
      {needsFix && onFix && (
        <button
          onClick={onFix}
          className="text-xs text-[#2d6ba6] hover:text-[#13202e] underline"
        >
          Fix
        </button>
      )}
    </div>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to manage extraction UI state
 */
export function useExtractionUI() {
  const [isFixing, setIsFixing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  const startFix = useCallback(() => {
    setIsFixing(true);
  }, []);
  
  const endFix = useCallback(() => {
    setIsFixing(false);
  }, []);
  
  const toggleDebug = useCallback(() => {
    setShowDebug(prev => !prev);
  }, []);
  
  return {
    isFixing,
    showDebug,
    startFix,
    endFix,
    toggleDebug,
  };
}
