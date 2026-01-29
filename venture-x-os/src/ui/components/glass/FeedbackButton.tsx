/**
 * Feedback Button Component
 * 
 * Allows users to report incorrect or unhelpful responses.
 * Integrates with trust telemetry for quality improvement.
 * 
 * @module ui/components/glass/FeedbackButton
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, ThumbsUp, ThumbsDown, X, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTrustTelemetry } from '../../../telemetry/trustTelemetry';
import type { ChunkWithProvenance } from '../../../knowledge/sourceMetadata';

// ============================================
// TYPES
// ============================================

export interface FeedbackButtonProps {
  /** The response text that was shown to the user */
  response: string;
  
  /** The query that generated this response */
  query?: string;
  
  /** Retrieved chunks used to generate the response */
  retrievedChunks?: ChunkWithProvenance[];
  
  /** Callback when feedback is submitted */
  onFeedbackSubmitted?: (type: 'positive' | 'negative', comment?: string) => void;
  
  /** Additional context for telemetry */
  telemetryContext?: {
    intentClassification?: string;
    computeIntentUsed?: boolean;
    citationCount?: number;
  };
  
  /** Additional CSS classes */
  className?: string;
  
  /** Variant style */
  variant?: 'minimal' | 'full';
}

// ============================================
// FEEDBACK BUTTON COMPONENT
// ============================================

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  response,
  query = '',
  retrievedChunks = [],
  onFeedbackSubmitted,
  telemetryContext = {},
  className,
  variant = 'minimal',
}) => {
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const telemetry = useTrustTelemetry();

  const handlePositiveFeedback = async () => {
    if (isSubmitted) return;
    
    setFeedbackType('positive');
    setIsSubmitting(true);
    
    try {
      if (telemetry.isEnabled()) {
        await telemetry.logPositiveFeedback(
          query,
          response,
          retrievedChunks,
          telemetryContext
        );
      }
      
      onFeedbackSubmitted?.('positive');
      setIsSubmitted(true);
    } catch (error) {
      console.warn('[FeedbackButton] Failed to submit positive feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegativeFeedback = () => {
    if (isSubmitted) return;
    setFeedbackType('negative');
    setShowForm(true);
  };

  const handleSubmitNegativeFeedback = async () => {
    if (isSubmitted) return;
    
    setIsSubmitting(true);
    
    try {
      if (telemetry.isEnabled()) {
        await telemetry.logNegativeFeedback(
          query,
          response,
          retrievedChunks,
          comment || undefined,
          telemetryContext
        );
      }
      
      onFeedbackSubmitted?.('negative', comment);
      setIsSubmitted(true);
      setShowForm(false);
    } catch (error) {
      console.warn('[FeedbackButton] Failed to submit negative feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setComment('');
    setFeedbackType(null);
  };

  // Show success state
  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'flex items-center gap-2 text-xs',
          feedbackType === 'positive' ? 'text-emerald-400' : 'text-amber-400',
          className
        )}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Thanks for your feedback!</span>
      </motion.div>
    );
  }

  // Minimal variant - just thumbs up/down
  if (variant === 'minimal' && !showForm) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <motion.button
          onClick={handlePositiveFeedback}
          disabled={isSubmitting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-150',
            'text-white/30 hover:text-emerald-400 hover:bg-emerald-400/10',
            isSubmitting && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Helpful"
          title="This was helpful"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </motion.button>
        
        <motion.button
          onClick={handleNegativeFeedback}
          disabled={isSubmitting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-150',
            'text-white/30 hover:text-rose-400 hover:bg-rose-400/10',
            isSubmitting && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Not helpful"
          title="Report an issue"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    );
  }

  // Full variant or feedback form is open
  return (
    <div className={cn('space-y-2', className)}>
      {!showForm ? (
        // Full variant initial state
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Was this helpful?</span>
          <div className="flex items-center gap-1">
            <motion.button
              onClick={handlePositiveFeedback}
              disabled={isSubmitting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150',
                'text-white/40 hover:text-emerald-400 hover:bg-emerald-400/10 border border-transparent hover:border-emerald-400/20',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span className="text-xs">Yes</span>
            </motion.button>
            
            <motion.button
              onClick={handleNegativeFeedback}
              disabled={isSubmitting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150',
                'text-white/40 hover:text-rose-400 hover:bg-rose-400/10 border border-transparent hover:border-rose-400/20',
                isSubmitting && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span className="text-xs">No</span>
            </motion.button>
          </div>
        </div>
      ) : (
        // Feedback form
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-white/70">
                  What went wrong?
                </span>
              </div>
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </div>
            
            {/* Comment textarea */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what was incorrect or unhelpful (optional)"
              rows={3}
              className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-white/[0.04] border border-white/[0.08] rounded-lg',
                'text-white placeholder:text-white/30',
                'focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.06]',
                'resize-none transition-all duration-150'
              )}
            />
            
            {/* Quick issue tags */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Incorrect info',
                'Outdated',
                'Missing details',
                'Bad math',
                'Wrong source',
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setComment(prev => prev ? `${prev}; ${tag}` : tag)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded-full',
                    'bg-white/[0.04] border border-white/[0.06]',
                    'text-white/50 hover:text-white/70 hover:bg-white/[0.08]',
                    'transition-all duration-150'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            
            {/* Submit buttons */}
            <div className="flex items-center justify-end gap-2">
              <motion.button
                onClick={handleCancel}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg',
                  'text-white/50 hover:text-white/70',
                  'bg-white/[0.04] hover:bg-white/[0.08]',
                  'transition-all duration-150'
                )}
              >
                Cancel
              </motion.button>
              
              <motion.button
                onClick={handleSubmitNegativeFeedback}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg',
                  'bg-amber-500/20 border border-amber-500/30 text-amber-400',
                  'hover:bg-amber-500/30',
                  'transition-all duration-150',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Send className="w-3 h-3" />
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

// ============================================
// INLINE FEEDBACK LINK (Alternative minimal style)
// ============================================

export interface InlineFeedbackLinkProps {
  response: string;
  query?: string;
  retrievedChunks?: ChunkWithProvenance[];
  onFeedbackSubmitted?: () => void;
  className?: string;
}

export const InlineFeedbackLink: React.FC<InlineFeedbackLinkProps> = ({
  response,
  query,
  retrievedChunks = [],
  onFeedbackSubmitted,
  className,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const telemetry = useTrustTelemetry();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      if (telemetry.isEnabled()) {
        await telemetry.logNegativeFeedback(
          query || '',
          response,
          retrievedChunks,
          comment || undefined
        );
      }
      
      setIsSubmitted(true);
      setShowForm(false);
      onFeedbackSubmitted?.();
    } catch (error) {
      console.warn('[InlineFeedbackLink] Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <span className={cn('text-xs text-emerald-400/60', className)}>
        ✓ Feedback sent
      </span>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className={cn(
          'text-xs text-white/40 hover:text-white/60',
          'underline decoration-dotted underline-offset-2',
          'transition-colors duration-150',
          className
        )}
      >
        🚩 That doesn't seem right
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mt-2 space-y-2', className)}
    >
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What's wrong? (optional)"
        rows={2}
        className={cn(
          'w-full px-2 py-1.5 text-xs',
          'bg-white/[0.04] border border-white/[0.08] rounded',
          'text-white placeholder:text-white/30',
          'focus:outline-none focus:border-amber-500/40',
          'resize-none'
        )}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            'px-2 py-1 text-[10px] rounded',
            'bg-amber-500/20 text-amber-400',
            'hover:bg-amber-500/30',
            isSubmitting && 'opacity-50'
          )}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </button>
        <button
          onClick={() => { setShowForm(false); setComment(''); }}
          className="px-2 py-1 text-[10px] text-white/40 hover:text-white/60"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

export default FeedbackButton;
