'use client';

/**
 * PremiumCard — Enhanced with Magic UI MagicCard spotlight effect
 *
 * Features integrated from MCP-sourced components:
 *  • MagicCard spotlight — mouse-tracking golden glow on border + inner fill
 *    (source: Magic UI via Context7 MCP — magicui.design/docs/components/magic-card)
 *  • Grid pattern background (original)
 *
 * Colour scheme: gold (#f59e0b) + black (#0A0A0B)
 */

import React, { ReactNode, useCallback, useEffect, useId } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
/* ─── Grid Pattern (SVG background) ─── */
interface GridPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  squares?: [number, number][];
}

function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  squares,
  ...props
}: GridPatternProps) {
  const patternId = useId();

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill={`url(#${patternId})`}
      />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy], index) => (
            <rect
              strokeWidth="0"
              key={`${sx}-${sy}-${index}`}
              width={width + 1}
              height={height + 1}
              x={sx * width}
              y={sy * height}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}

/* ─── Props ─── */
interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  /** Enable lift-on-hover */
  hover?: boolean;
  /** Enable ambient glow shadow on hover */
  glow?: boolean;
  /** Entrance animation delay (seconds) */
  delay?: number;
  /** Enable mouse-tracking spotlight (Magic UI MagicCard) */
  spotlight?: boolean;
  /** Spotlight gradient radius in pixels */
  gradientSize?: number;
}

/* ─── Component ─── */
export default function PremiumCard({
  children,
  className = '',
  hover = true,
  glow = true,
  delay = 0,
  spotlight = true,
  gradientSize = 200,
}: PremiumCardProps) {
  /* ── Mouse-tracking motion values (from Magic UI MagicCard) ── */
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [gradientSize, mouseX, mouseY]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  useEffect(() => {
    reset();
  }, [reset]);

  /* Clean up global pointer events (from Magic UI) */
  useEffect(() => {
    const handleGlobalPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) reset();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') reset();
    };

    window.addEventListener('pointerout', handleGlobalPointerOut);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointerout', handleGlobalPointerOut);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reset]);

  /* ── Spotlight templates (gold-themed) ── */
  const spotlightBorder = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      rgba(245, 158, 11, 0.35),
      rgba(245, 158, 11, 0.12),
      transparent 100%
    )`;

  const spotlightInner = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      rgba(245, 158, 11, 0.06),
      transparent 100%
    )`;

  /* Grid pattern highlighted squares */
  const gridSquares: [number, number][] = [
    [1, 2],
    [3, 4],
    [6, 1],
    [8, 5],
    [4, 7],
    [10, 3],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        hover
          ? {
              y: -4,
              transition: { type: 'spring', stiffness: 300, damping: 20 },
            }
          : undefined
      }
      className={cn('group relative rounded-2xl', className)}
      onPointerMove={spotlight ? handlePointerMove : undefined}
      onPointerLeave={spotlight ? reset : undefined}
    >
      {/* ── Layer 1: Spotlight border glow (mouse-tracking, from MagicCard) ── */}
      {spotlight && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlightBorder }}
        />
      )}

      {/* ── Layer 2: Card background fill ── */}
      <div
        className={cn(
          'absolute inset-px rounded-[inherit] bg-[#0A0A0B]',
          'transition-[background-color] duration-300',
          hover && 'group-hover:bg-[#0f0f11]',
        )}
      />

      {/* ── Layer 3: Inner spotlight fill (mouse-tracking, from MagicCard) ── */}
      {spotlight && (
        <motion.div
          className="pointer-events-none absolute inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlightInner }}
        />
      )}

      {/* ── Layer 4: Static border (visible at rest, hides when spotlight active) ── */}
      <div className="absolute inset-0 rounded-[inherit] border border-white/[0.08] pointer-events-none transition-[border-color] duration-300 group-hover:border-white/[0.04]" />

      {/* ── Layer 5: Gold top-edge highlight on hover ── */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/0 to-transparent group-hover:via-amber-500/40 transition-all duration-500 z-[1]" />

      {/* ── Layer 6: Subtle grid pattern ── */}
      <GridPattern
        width={40}
        height={40}
        x={-1}
        y={-1}
        squares={gridSquares}
        className={cn(
          'absolute inset-0 h-full w-full',
          'fill-white/[0.02] stroke-white/[0.05]',
          '[mask-image:radial-gradient(ellipse_at_center,white_10%,transparent_60%)]',
        )}
        style={{ borderRadius: 'inherit', zIndex: 0 }}
      />

      {/* ── Layer 7: Ambient glow shadow ── */}
      {glow && (
        <div className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shadow-[0_8px_32px_-8px_rgba(245,158,11,0.18)]" />
      )}

      {/* ── Content ── */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
