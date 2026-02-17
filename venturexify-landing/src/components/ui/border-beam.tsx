'use client';

/**
 * BorderBeam — Adapted from Magic UI (magicui.design)
 * An animated beam of light that travels along the border of its container.
 * Customised for gold (#f59e0b) + black (#0A0A0B) theme.
 *
 * @source https://magicui.design/docs/components/border-beam
 */

import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  /** Width of the beam highlight in pixels */
  size?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Animation delay in seconds */
  delay?: number;
  /** Starting gradient colour */
  colorFrom?: string;
  /** Ending gradient colour */
  colorTo?: string;
  /** Whether to reverse direction */
  reverse?: boolean;
  /** Border width */
  borderWidth?: number;
}

export function BorderBeam({
  className,
  size = 80,
  duration = 6,
  delay = 0,
  colorFrom = '#f59e0b',
  colorTo = '#fbbf24',
  reverse = false,
  borderWidth = 1,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
      style={{
        padding: `${borderWidth}px`,
        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMask:
          'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    >
      <div
        className={cn(
          'absolute aspect-square animate-border-beam',
          className,
        )}
        style={
          {
            width: `${size}px`,
            background: `linear-gradient(${reverse ? '90deg' : '270deg'}, ${colorFrom} 0%, ${colorTo} 100%)`,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
