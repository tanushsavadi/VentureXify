// ============================================
// PREMIUM DESIGN TOKENS v2.0
// OLED black + glassmorphism theme
// 
// Single source of truth for TypeScript components.
// Mirrors CSS custom properties in globals.css
// ============================================

export const tokens = {
  // ============================================
  // COLORS
  // ============================================
  colors: {
    // Background (OLED Black)
    bg: {
      base: '#000000',
      elevated: '#030303',
      overlay: 'rgba(0, 0, 0, 0.80)',
    },

    // Glass Surfaces (Translucent)
    surface: {
      1: 'rgba(255, 255, 255, 0.02)',
      2: 'rgba(255, 255, 255, 0.04)',
      3: 'rgba(255, 255, 255, 0.06)',
      4: 'rgba(255, 255, 255, 0.08)',
      5: 'rgba(255, 255, 255, 0.10)',
    },

    // Primary Accent (Indigo/Violet)
    accent: {
      DEFAULT: '#6366f1',
      soft: 'rgba(99, 102, 241, 0.15)',
      glow: 'rgba(99, 102, 241, 0.25)',
      muted: '#818cf8',
      strong: '#4f46e5',
    },

    // Semantic
    success: {
      DEFAULT: '#10b981',
      soft: 'rgba(16, 185, 129, 0.12)',
      glow: 'rgba(16, 185, 129, 0.20)',
    },
    warning: {
      DEFAULT: '#f59e0b',
      soft: 'rgba(245, 158, 11, 0.12)',
    },
    danger: {
      DEFAULT: '#ef4444',
      soft: 'rgba(239, 68, 68, 0.12)',
    },
  },

  // ============================================
  // TEXT
  // ============================================
  text: {
    primary: 'rgba(255, 255, 255, 0.95)',
    secondary: 'rgba(255, 255, 255, 0.70)',
    tertiary: 'rgba(255, 255, 255, 0.50)',
    muted: 'rgba(255, 255, 255, 0.35)',
    disabled: 'rgba(255, 255, 255, 0.25)',
  },

  // ============================================
  // BORDERS
  // ============================================
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    default: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.12)',
    accent: 'rgba(99, 102, 241, 0.40)',
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadow: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.4)',
    md: '0 4px 16px rgba(0, 0, 0, 0.5)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
    xl: '0 16px 64px rgba(0, 0, 0, 0.7)',
    glowAccent: '0 0 20px rgba(99, 102, 241, 0.20)',
    glowAccentStrong: '0 0 40px rgba(99, 102, 241, 0.35)',
    glowSuccess: '0 0 20px rgba(16, 185, 129, 0.20)',
  },

  // ============================================
  // HIGHLIGHTS (Inner Top Edge)
  // ============================================
  highlight: {
    subtle: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    medium: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    strong: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
  },

  // ============================================
  // BLUR VALUES
  // ============================================
  blur: {
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
  },

  // ============================================
  // BORDER RADIUS
  // ============================================
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
    '2xl': '24px',
    full: '9999px',
  },

  // ============================================
  // SPACING
  // ============================================
  spacing: {
    0: '0',
    px: '1px',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    2.5: '10px',
    3: '12px',
    3.5: '14px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  // ============================================
  // TYPOGRAPHY
  // ============================================
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    fontSize: {
      xs: '11px',
      sm: '13px',
      base: '15px',
      lg: '17px',
      xl: '20px',
      '2xl': '24px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.2',
      normal: '1.5',
      relaxed: '1.65',
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.02em',
    },
  },

  // ============================================
  // TRANSITIONS
  // ============================================
  transition: {
    duration: {
      instant: '0ms',
      fast: '120ms',
      normal: '180ms',
      slow: '280ms',
      slower: '400ms',
    },
    easing: {
      linear: 'linear',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },

  // ============================================
  // Z-INDEX
  // ============================================
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modalBackdrop: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
    toast: 80,
  },
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type Tokens = typeof tokens;
export type SurfaceLevel = keyof typeof tokens.colors.surface;
export type RadiusSize = keyof typeof tokens.radius;
export type BlurLevel = keyof typeof tokens.blur;
export type TextColor = keyof typeof tokens.text;
