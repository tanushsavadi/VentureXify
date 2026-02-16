/**
 * Premium Glassmorphism Component Library v2.0
 * OLED-dark + frosted glass + refined micro-interactions
 * 
 * Uses CSS custom properties from globals.css for consistency
 */

import React, { forwardRef, ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../../lib/utils';

// Re-export sibling components
export { GlassSegmentedControl, GlassProgressRail } from './SegmentedControl';
export { GlassStrategyCard, GlassVerdictCard } from './StrategyCard';
export { ProgressiveVerdictCard } from './ProgressiveVerdictCard';
export type { VerdictDataProgressive, RankingMode, DoubleDipStrategyInfo } from './ProgressiveVerdictCard';
export { SavingsWaterfall } from './SavingsWaterfall';
export type { SavingsWaterfallProps } from './SavingsWaterfall';
export { TransferPartnersCard } from './TransferPartnersCard';
export type { TransferPartnersCardProps } from './TransferPartnersCard';
export { AskAboutVerdictModule } from './AskAboutVerdictModule';
export type { VerdictContext, AskAboutVerdictModuleProps } from './AskAboutVerdictModule';
export { FeedbackButton, InlineFeedbackLink } from './FeedbackButton';
export type { FeedbackButtonProps, InlineFeedbackLinkProps } from './FeedbackButton';
export { BookingSuccessState } from './BookingSuccessState';
export { StepChangeDialog } from './StepChangeDialog';
export type { StepChangeDialogProps } from './StepChangeDialog';
export { OutOfOrderStepWarning } from './OutOfOrderStepWarning';
export type { OutOfOrderStepWarningProps } from './OutOfOrderStepWarning';

// ============================================
// GLASS PANEL - Container with blur/noise
// ============================================

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle';
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  noise?: boolean;
  className?: string;
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, variant = 'default', blur = 'md', noise = true, className, ...props }, ref) => {
    const blurValues = {
      sm: 'var(--blur-sm)',
      md: 'var(--blur-md)',
      lg: 'var(--blur-lg)',
      xl: 'var(--blur-xl)',
    };

    const variantStyles = {
      default: 'bg-surface-2 border-[var(--border-default)]',
      elevated: 'bg-surface-3 border-[var(--border-strong)]',
      subtle: 'bg-surface-1 border-[var(--border-subtle)]',
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative rounded-xl border',
          'shadow-md',
          variantStyles[variant],
          className
        )}
        style={{
          backdropFilter: `blur(${blurValues[blur]})`,
          WebkitBackdropFilter: `blur(${blurValues[blur]})`,
          boxShadow: 'var(--shadow-md), var(--highlight-subtle)',
        }}
        {...props}
      >
        {/* Noise texture overlay */}
        {noise && (
          <div 
            className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-[0.012] mix-blend-overlay"
            style={{ backgroundImage: 'var(--noise-texture)' }}
          />
        )}
        {/* Inner highlight */}
        <div 
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ boxShadow: 'var(--highlight-subtle)' }}
        />
        {children}
      </motion.div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

// ============================================
// GLASS CARD - Content card with animations
// ============================================

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'interactive' | 'winner';
  animateIn?: boolean;
  delay?: number;
  className?: string;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, variant = 'default', animateIn = true, delay = 0, className, ...props }, ref) => {
    const variantStyles = {
      default: cn(
        'bg-surface-2 border-[var(--border-default)]',
        'hover:bg-surface-3 hover:border-[var(--border-strong)]'
      ),
      elevated: cn(
        'bg-surface-3 border-[var(--border-strong)]'
      ),
      interactive: cn(
        'bg-surface-2 border-[var(--border-default)]',
        'hover:bg-surface-3 hover:border-[var(--border-strong)]',
        'cursor-pointer'
      ),
      winner: cn(
        'bg-surface-4 border-[var(--border-accent)]'
      ),
    };

    const variantShadows = {
      default: 'var(--shadow-sm), var(--highlight-subtle)',
      elevated: 'var(--shadow-md), var(--highlight-medium)',
      interactive: 'var(--shadow-sm), var(--highlight-subtle)',
      winner: 'var(--shadow-md), var(--glow-accent), var(--highlight-medium)',
    };

    return (
      <motion.div
        ref={ref}
        initial={animateIn ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, delay, ease: [0, 0, 0.2, 1] }}
        className={cn(
          'relative rounded-lg border p-4',
          'backdrop-blur-md',
          'transition-all duration-fast ease-out-custom',
          variantStyles[variant],
          className
        )}
        style={{ boxShadow: variantShadows[variant] }}
        whileHover={variant === 'interactive' ? { y: -1 } : undefined}
        whileTap={variant === 'interactive' ? { scale: 0.99 } : undefined}
        {...props}
      >
        {/* Noise texture */}
        <div 
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-[0.012] mix-blend-overlay"
          style={{ backgroundImage: 'var(--noise-texture)' }}
        />
        {/* Inner highlight */}
        <div 
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ boxShadow: 'var(--highlight-subtle)' }}
        />
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// ============================================
// GLASS BUTTON - Primary action button
// ============================================

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  className?: string;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ 
    children, 
    variant = 'default', 
    size = 'md',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled,
    className, 
    ...props 
  }, ref) => {
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
      md: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
      lg: 'px-5 py-3 text-base gap-2.5 rounded-lg',
    };

    const variantStyles = {
      default: cn(
        'bg-surface-4 border-[var(--border-strong)]',
        'hover:bg-surface-5 hover:border-[var(--border-strong)]',
        'text-[var(--text-primary)]'
      ),
      primary: cn(
        'border-[var(--border-accent)]',
        'text-[var(--text-primary)]'
      ),
      secondary: cn(
        'bg-surface-2 border-[var(--border-default)]',
        'hover:bg-surface-3 hover:border-[var(--border-strong)]',
        'text-[var(--text-secondary)]'
      ),
      ghost: cn(
        'bg-transparent border-transparent',
        'hover:bg-surface-2 hover:border-[var(--border-subtle)]',
        'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      ),
    };

    const getBoxShadow = () => {
      switch (variant) {
        case 'primary':
          return 'var(--shadow-sm), var(--glow-accent), var(--highlight-medium)';
        case 'default':
          return 'var(--shadow-sm), var(--highlight-subtle)';
        case 'secondary':
          return 'var(--highlight-subtle)';
        default:
          return 'none';
      }
    };

    return (
      <motion.button
        ref={ref as React.RefObject<HTMLButtonElement>}
        disabled={disabled || loading}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        transition={{ duration: 0.08 }}
        className={cn(
          'relative inline-flex items-center justify-center font-semibold',
          'border backdrop-blur-sm',
          'transition-all duration-fast ease-out-custom',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        style={{
          boxShadow: getBoxShadow(),
          background: variant === 'primary'
            ? 'linear-gradient(135deg, rgba(74,144,217,0.25), rgba(45,106,163,0.18))'
            : undefined,
        }}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {/* Inner highlight */}
        <span 
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ boxShadow: variant === 'primary' ? 'var(--highlight-medium)' : 'var(--highlight-subtle)' }}
        />
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-inherit">
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
              />
            </svg>
          ) : (
            <>
              {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
              {children}
              {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
            </>
          )}
        </span>
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

// ============================================
// GLASS BADGE - Status/tag indicator
// ============================================

interface GlassBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'accent' | 'muted';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const GlassBadge = forwardRef<HTMLSpanElement, GlassBadgeProps>(
  ({ children, variant = 'default', size = 'sm', dot = false, pulse = false, className, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-2.5 py-1 text-xs',
    };

    const variantStyles = {
      default: 'bg-surface-2 text-[var(--text-secondary)] border-[var(--border-default)]',
      success: 'bg-[var(--success-soft)] text-[var(--success)] border-[rgba(16,185,129,0.25)]',
      warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[rgba(245,158,11,0.25)]',
      error: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[rgba(239,68,68,0.25)]',
      accent: 'bg-[var(--accent-soft)] text-[var(--accent-muted)] border-[rgba(74,144,217,0.25)]',
      // UX FIX: Improved muted badge contrast for accessibility (was --text-muted which was too low contrast)
      muted: 'bg-surface-1 text-[var(--text-tertiary)] border-[var(--border-default)]',
    };

    const dotColors = {
      default: 'bg-[var(--text-tertiary)]',
      success: 'bg-[var(--success)]',
      warning: 'bg-[var(--warning)]',
      error: 'bg-[var(--danger)]',
      accent: 'bg-[var(--accent)]',
      muted: 'bg-[var(--text-muted)]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium rounded-full border',
          'backdrop-blur-sm',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span className="relative flex h-1.5 w-1.5">
            {pulse && (
              <span 
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                  dotColors[variant]
                )} 
              />
            )}
            <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', dotColors[variant])} />
          </span>
        )}
        {children}
      </span>
    );
  }
);

GlassBadge.displayName = 'GlassBadge';

// ============================================
// GLASS INPUT - Text input field
// ============================================

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  className?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ icon, className, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 text-sm rounded-lg',
            'bg-surface-2 border border-[var(--border-default)]',
            'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
            'backdrop-blur-sm',
            'transition-all duration-fast ease-out-custom',
            'hover:bg-surface-3 hover:border-[var(--border-strong)]',
            'focus:outline-none focus:bg-surface-3 focus:border-[var(--accent)]',
            'focus:ring-2 focus:ring-[var(--accent-soft)]',
            icon && 'pl-10',
            className
          )}
          style={{ boxShadow: 'var(--highlight-subtle)' }}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

// ============================================
// GLASS DIVIDER
// ============================================

interface GlassDividerProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const GlassDivider: React.FC<GlassDividerProps> = ({ 
  className, 
  orientation = 'horizontal' 
}) => (
  <div 
    className={cn(
      'bg-[var(--border-default)]',
      orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
      className
    )} 
  />
);

// ============================================
// GLASS SKELETON - Loading placeholder
// ============================================

interface GlassSkeletonProps {
  className?: string;
  /** Variant for different skeleton shapes */
  variant?: 'default' | 'circular' | 'text' | 'button';
}

export const GlassSkeleton: React.FC<GlassSkeletonProps> = ({ className, variant = 'default' }) => {
  const variantStyles = {
    default: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded h-4',
    button: 'rounded-lg h-10',
  };

  return (
    <div
      className={cn(
        'bg-surface-2 animate-shimmer',
        variantStyles[variant],
        className
      )}
      style={{
        background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
};

// ============================================
// GLASS SKELETON CARD - Loading card placeholder
// ============================================

interface GlassSkeletonCardProps {
  /** Number of text lines to show */
  lines?: number;
  /** Show avatar/icon placeholder */
  showIcon?: boolean;
  className?: string;
}

export const GlassSkeletonCard: React.FC<GlassSkeletonCardProps> = ({
  lines = 3,
  showIcon = true,
  className
}) => (
  <div
    className={cn(
      'p-4 rounded-xl bg-surface-2 border border-[var(--border-default)] space-y-3',
      className
    )}
  >
    {/* Header with icon */}
    <div className="flex items-center gap-3">
      {showIcon && <GlassSkeleton variant="circular" className="w-10 h-10 flex-shrink-0" />}
      <div className="flex-1 space-y-2">
        <GlassSkeleton variant="text" className="w-3/4" />
        <GlassSkeleton variant="text" className="w-1/2 h-3" />
      </div>
    </div>
    {/* Content lines */}
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <GlassSkeleton
          key={i}
          variant="text"
          className={cn(
            i === lines - 1 ? 'w-2/3' : 'w-full'
          )}
        />
      ))}
    </div>
  </div>
);

// ============================================
// GLASS EMPTY STATE - No data placeholder
// ============================================

interface GlassEmptyStateProps {
  /** Icon to display (JSX element) */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const GlassEmptyState: React.FC<GlassEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className={cn('text-center py-10 px-4', className)}
  >
    {/* Icon */}
    {icon && (
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#4a90d9]/10 to-[#1e3048]/10 border border-white/[0.08] flex items-center justify-center">
        <div className="text-white/25">{icon}</div>
      </div>
    )}
    
    {/* Title */}
    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
    
    {/* Description */}
    {description && (
      <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-[280px] mx-auto leading-relaxed">
        {description}
      </p>
    )}
    
    {/* Actions */}
    {(action || secondaryAction) && (
      <div className="flex flex-col gap-3 max-w-[260px] mx-auto">
        {action && (
          <GlassButton variant="primary" className="w-full" onClick={action.onClick}>
            {action.label}
          </GlassButton>
        )}
        {secondaryAction && (
          <GlassButton variant="ghost" className="w-full" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </GlassButton>
        )}
      </div>
    )}
  </motion.div>
);

// ============================================
// GLASS ERROR STATE - Error with recovery action
// ============================================

interface GlassErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message or description */
  message?: string;
  /** Retry action */
  onRetry?: () => void;
  /** Fallback action (alternative path) */
  fallbackAction?: {
    label: string;
    onClick: () => void;
  };
  /** Is retrying */
  isRetrying?: boolean;
  className?: string;
}

export const GlassErrorState: React.FC<GlassErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'Unable to load data. Please try again.',
  onRetry,
  fallbackAction,
  isRetrying = false,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className={cn(
      'p-5 rounded-xl bg-red-500/5 border border-red-500/20 text-center',
      className
    )}
  >
    {/* Error icon */}
    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
      <svg
        className="w-6 h-6 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    
    {/* Title */}
    <h4 className="text-base font-semibold text-red-400 mb-1">{title}</h4>
    
    {/* Message */}
    <p className="text-sm text-[var(--text-tertiary)] mb-4 max-w-[240px] mx-auto">
      {message}
    </p>
    
    {/* Actions */}
    <div className="flex flex-col gap-2">
      {onRetry && (
        <GlassButton
          variant="secondary"
          size="sm"
          className="mx-auto"
          onClick={onRetry}
          loading={isRetrying}
        >
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </GlassButton>
      )}
      {fallbackAction && (
        <button
          onClick={fallbackAction.onClick}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {fallbackAction.label}
        </button>
      )}
    </div>
  </motion.div>
);

// ============================================
// AURORA BACKGROUND - Subtle animated gradient
// ============================================

export const AuroraBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <motion.div
      className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%]"
      style={{
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(74, 144, 217, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(45, 106, 163, 0.04) 0%, transparent 50%)
        `,
      }}
      animate={{
        x: ['0%', '2%', '-1%', '0%'],
        y: ['0%', '1%', '2%', '0%'],
        rotate: [0, 1, -0.5, 0],
      }}
      transition={{
        duration: 40,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </div>
);

// ============================================
// EXPORTS
// ============================================

export default {
  GlassPanel,
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassDivider,
  GlassSkeleton,
  GlassSkeletonCard,
  GlassEmptyState,
  GlassErrorState,
  AuroraBackground,
};
