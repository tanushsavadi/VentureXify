/**
 * Ask About Verdict Module
 * 
 * A compact inline chat prompt module for the Verdict screen.
 * Provides contextual quick-ask chips and a message composer.
 * Routes to Chat tab with question prefilled.
 * 
 * Features:
 * - Single-line message composer with send icon
 * - 2-3 dynamic context-aware prompt chips based on verdict state
 * - Passes context (route, prices, effective cost, CPP) to chat
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================
// TYPES
// ============================================

export interface VerdictContext {
  winner: 'portal' | 'direct' | 'award' | 'tie';
  winnerLabel: string;
  portalPrice: number;
  directPrice: number;
  effectiveCost?: number;
  portalMilesEarned?: number;
  directMilesEarned?: number;
  awardCpp?: number;
  creditApplied?: number;
  route?: string; // e.g., "JFK → LAX"
  tabMode?: 'cheapest' | 'max_value' | 'easiest';
}

export interface AskAboutVerdictModuleProps {
  context: VerdictContext;
  onAskQuestion: (question: string, context: VerdictContext) => void;
  className?: string;
}

// ============================================
// PROMPT CHIP GENERATORS
// ============================================

interface PromptChip {
  id: string;
  text: string;
  shortText?: string;
}

function generatePromptChips(ctx: VerdictContext): PromptChip[] {
  const chips: PromptChip[] = [];
  
  // Chip 1: Why is X recommended?
  if (ctx.winner !== 'tie') {
    chips.push({
      id: 'why-recommended',
      text: `Why is ${ctx.winnerLabel} recommended for this trip?`,
      shortText: `Why ${ctx.winnerLabel}?`,
    });
  } else {
    chips.push({
      id: 'why-tie',
      text: 'What would tip the decision one way?',
      shortText: 'What could tip it?',
    });
  }
  
  // Chip 2: Value-based question
  if (ctx.awardCpp !== undefined && ctx.awardCpp > 0) {
    const cppStr = ctx.awardCpp.toFixed(2);
    chips.push({
      id: 'award-value',
      text: `Is ${cppStr}¢/mi a good redemption here?`,
      shortText: `${cppStr}¢/mi good?`,
    });
  } else if (ctx.portalMilesEarned && ctx.directMilesEarned) {
    const diff = Math.abs(ctx.portalMilesEarned - ctx.directMilesEarned);
    if (diff > 500) {
      chips.push({
        id: 'miles-diff',
        text: `Is ${diff.toLocaleString()} more miles worth the tradeoff?`,
        shortText: `Worth ${diff.toLocaleString()} miles?`,
      });
    }
  }
  
  // Chip 3: Transfer partner question (for portal winner or max value)
  if (ctx.winner === 'portal' || ctx.tabMode === 'max_value') {
    chips.push({
      id: 'transfer-partners',
      text: 'Which transfer partners should I check for this airline?',
      shortText: 'Transfer partners?',
    });
  }
  
  // Chip 4: What could change the decision
  if (chips.length < 3) {
    chips.push({
      id: 'what-changes',
      text: 'What changes could flip the decision?',
      shortText: 'What could flip it?',
    });
  }
  
  // Return max 3 chips
  return chips.slice(0, 3);
}

// ============================================
// MAIN COMPONENT
// ============================================

export const AskAboutVerdictModule: React.FC<AskAboutVerdictModuleProps> = ({
  context,
  onAskQuestion,
  className,
}) => {
  const [inputValue, setInputValue] = useState('');
  
  // Generate context-aware prompt chips
  const promptChips = useMemo(() => generatePromptChips(context), [context]);
  
  const handleSend = () => {
    if (!inputValue.trim()) return;
    onAskQuestion(inputValue.trim(), context);
    setInputValue('');
  };
  
  const handleChipClick = (chip: PromptChip) => {
    onAskQuestion(chip.text, context);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.25 }}
      className={cn(
        'p-4 rounded-xl',
        'bg-white/[0.03] border border-white/[0.06]',
        'space-y-3',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-medium text-white/70">
          Ask about this verdict
        </span>
      </div>
      
      {/* Message Composer */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about portal vs direct, travel eraser, transfer partners…"
            className={cn(
              'w-full px-3 py-2.5 pr-10',
              'text-sm text-white placeholder:text-white/30',
              'bg-white/[0.04] border border-white/[0.08] rounded-lg',
              'focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06]',
              'transition-all duration-150'
            )}
          />
        </div>
        <motion.button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'flex items-center justify-center',
            'w-10 h-10 rounded-lg',
            'transition-all duration-150',
            inputValue.trim()
              ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30'
              : 'bg-white/[0.04] border border-white/[0.06] text-white/30 cursor-not-allowed'
          )}
          aria-label="Send question"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
      
      {/* Prompt Chips */}
      {promptChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {promptChips.map((chip, index) => (
            <motion.button
              key={chip.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onClick={() => handleChipClick(chip)}
              className={cn(
                'px-3 py-1.5 rounded-full',
                'text-xs text-white/60',
                'bg-white/[0.04] border border-white/[0.06]',
                'hover:bg-white/[0.08] hover:text-white/80 hover:border-white/[0.10]',
                'transition-all duration-150',
                'cursor-pointer'
              )}
            >
              {chip.shortText || chip.text}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AskAboutVerdictModule;
