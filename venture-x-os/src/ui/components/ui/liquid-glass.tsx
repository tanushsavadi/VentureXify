"use client";

import React from "react";

// Types
interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'subtle';
}

interface GlassButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'verdict';
}

interface GlassChipProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

// Glass Effect Wrapper Component
export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
  onClick,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(255, 255, 255, 0.05)",
        };
      case 'subtle':
        return {
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
        };
      default:
        return {
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 255, 255, 0.03)",
        };
    }
  };

  const glassStyle = {
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...getVariantStyles(),
    ...style,
  };

  const content = (
    <div
      className={`relative flex font-medium overflow-hidden text-white cursor-pointer transition-all duration-500 ${className}`}
      style={glassStyle}
      onClick={onClick}
    >
      {/* Glass Layers */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-inherit"
        style={{
          backdropFilter: "blur(12px)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
          borderRadius: 'inherit',
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{ 
          background: "rgba(255, 255, 255, 0.06)",
          borderRadius: 'inherit',
        }}
      />
      <div
        className="absolute inset-0 z-20 overflow-hidden"
        style={{
          boxShadow:
            "inset 1px 1px 0 0 rgba(255, 255, 255, 0.15), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05)",
          borderRadius: 'inherit',
        }}
      />

      {/* Content */}
      <div className="relative z-30 w-full">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
};

// Glass Button Component
export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className = "",
  onClick,
  disabled = false,
  variant = 'primary',
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-white/10 hover:bg-white/15 border-white/20';
      case 'secondary':
        return 'bg-white/5 hover:bg-white/10 border-white/10';
      case 'ghost':
        return 'bg-transparent hover:bg-white/5 border-transparent';
      default:
        return 'bg-white/10 hover:bg-white/15 border-white/20';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden px-5 py-3 rounded-2xl font-medium text-sm
        border transition-all duration-300 ease-out
        ${getVariantClasses()}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}
        ${className}
      `}
      style={{
        backdropFilter: "blur(8px)",
        boxShadow: variant === 'primary' 
          ? "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          : "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Inner glow layer */}
      <div 
        className="absolute inset-0 rounded-inherit opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.15), transparent 60%)",
          borderRadius: 'inherit',
        }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

// Glass Card Component
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 60px rgba(255, 255, 255, 0.02)",
        };
      case 'verdict':
        return {
          background: "rgba(255, 255, 255, 0.1)",
          border: "2px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 12px 48px rgba(0, 0, 0, 0.4), 0 0 80px rgba(255, 255, 255, 0.04)",
        };
      default:
        return {
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
        };
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        backdropFilter: "blur(16px)",
        ...getVariantStyles(),
      }}
    >
      {/* Inner highlight */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          borderRadius: 'inherit',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

// Glass Chip Component  
export const GlassChip: React.FC<GlassChipProps> = ({
  children,
  className = "",
  active = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200 ease-out
        ${active 
          ? 'bg-white/15 border-white/25 text-white' 
          : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8'
        }
        border
        ${className}
      `}
      style={{
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </button>
  );
};

// Glass Input Component
export const GlassInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, onKeyDown, placeholder, className = "" }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`
        w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/40
        bg-white/5 border border-white/10
        focus:outline-none focus:bg-white/8 focus:border-white/20
        transition-all duration-200
        ${className}
      `}
      style={{
        backdropFilter: "blur(8px)",
      }}
    />
  );
};

// Glass Progress Rail Step
export const GlassProgressStep: React.FC<{
  step: number;
  label: string;
  isActive: boolean;
  isCompleted: boolean;
}> = ({ step, label, isActive, isCompleted }) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
          transition-all duration-300
          ${isActive 
            ? 'bg-white/20 text-white border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
            : isCompleted 
              ? 'bg-white/15 text-white/90 border-white/20' 
              : 'bg-white/5 text-white/40 border-white/10'
          }
          border
        `}
      >
        {isCompleted ? '✓' : step}
      </div>
      <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/50'}`}>
        {label}
      </span>
    </div>
  );
};

// SVG Filter Component - Must be included once in the app
export const GlassFilter: React.FC = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
    <defs>
      <filter
        id="glass-distortion"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.002 0.006"
          numOctaves="1"
          seed="42"
          result="turbulence"
        />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
        <feSpecularLighting
          in="softMap"
          surfaceScale="3"
          specularConstant="0.8"
          specularExponent="80"
          lightingColor="white"
          result="specLight"
        >
          <fePointLight x="-200" y="-200" z="200" />
        </feSpecularLighting>
        <feComposite
          in="specLight"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="1"
          k4="0"
          result="litImage"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="80"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);

// Demo/Example Component
export const Component = () => {
  return (
    <div
      className="min-h-screen h-full flex items-center justify-center font-light relative overflow-hidden w-full bg-black"
    >
      <GlassFilter />

      <div className="flex flex-col gap-6 items-center justify-center w-full max-w-md p-8">
        <GlassCard variant="elevated" className="p-6 w-full">
          <h2 className="text-xl font-semibold text-white mb-4">Liquid Glass Card</h2>
          <p className="text-white/60 text-sm">
            This card demonstrates the frosted glass effect with neutral colors.
          </p>
        </GlassCard>

        <div className="flex gap-3">
          <GlassButton variant="primary">Primary Action</GlassButton>
          <GlassButton variant="secondary">Secondary</GlassButton>
        </div>

        <div className="flex gap-2">
          <GlassChip active>Active</GlassChip>
          <GlassChip>Inactive</GlassChip>
        </div>
      </div>
    </div>
  );
};

export default {
  GlassEffect,
  GlassButton,
  GlassCard,
  GlassChip,
  GlassInput,
  GlassProgressStep,
  GlassFilter,
  Component,
};
