/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────
        // BACKGROUND (OLED Black)
        // ─────────────────────────────────────────
        bg: {
          base: '#000000',
          elevated: '#030303',
        },

        // ─────────────────────────────────────────
        // GLASS SURFACES (Semantic Names)
        // ─────────────────────────────────────────
        surface: {
          1: 'rgba(255, 255, 255, 0.02)',
          2: 'rgba(255, 255, 255, 0.04)',
          3: 'rgba(255, 255, 255, 0.06)',
          4: 'rgba(255, 255, 255, 0.08)',
          5: 'rgba(255, 255, 255, 0.10)',
        },

        // ─────────────────────────────────────────
        // PRIMARY ACCENT (Indigo/Violet)
        // ─────────────────────────────────────────
        accent: {
          DEFAULT: '#6366f1',
          soft: 'rgba(99, 102, 241, 0.15)',
          glow: 'rgba(99, 102, 241, 0.25)',
          muted: '#818cf8',
          strong: '#4f46e5',
          // Legacy shades for compatibility
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },

        // ─────────────────────────────────────────
        // SEMANTIC COLORS
        // ─────────────────────────────────────────
        success: {
          DEFAULT: '#10b981',
          soft: 'rgba(16, 185, 129, 0.12)',
          glow: 'rgba(16, 185, 129, 0.20)',
          light: '#34d399',
          dark: '#059669',
        },
        warning: {
          DEFAULT: '#f59e0b',
          soft: 'rgba(245, 158, 11, 0.12)',
          light: '#fbbf24',
          dark: '#d97706',
        },
        danger: {
          DEFAULT: '#ef4444',
          soft: 'rgba(239, 68, 68, 0.12)',
          light: '#f87171',
          dark: '#dc2626',
        },

        // ─────────────────────────────────────────
        // TEXT COLORS
        // ─────────────────────────────────────────
        txt: {
          primary: 'rgba(255, 255, 255, 0.95)',
          secondary: 'rgba(255, 255, 255, 0.70)',
          tertiary: 'rgba(255, 255, 255, 0.50)',
          muted: 'rgba(255, 255, 255, 0.35)',
          disabled: 'rgba(255, 255, 255, 0.25)',
        },

        // ─────────────────────────────────────────
        // BORDER COLORS
        // ─────────────────────────────────────────
        border: {
          subtle: 'rgba(255, 255, 255, 0.04)',
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.12)',
          accent: 'rgba(99, 102, 241, 0.40)',
        },

        // ─────────────────────────────────────────
        // GLASS SPECIFIC (Legacy Compatibility)
        // ─────────────────────────────────────────
        glass: {
          surface: {
            1: 'rgba(255, 255, 255, 0.02)',
            2: 'rgba(255, 255, 255, 0.04)',
            3: 'rgba(255, 255, 255, 0.06)',
            4: 'rgba(255, 255, 255, 0.08)',
            5: 'rgba(255, 255, 255, 0.10)',
          },
          border: {
            subtle: 'rgba(255, 255, 255, 0.04)',
            light: 'rgba(255, 255, 255, 0.08)',
            medium: 'rgba(255, 255, 255, 0.12)',
            strong: 'rgba(255, 255, 255, 0.16)',
          },
        },
      },

      // ─────────────────────────────────────────
      // FONT FAMILY
      // ─────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ─────────────────────────────────────────
      // FONT SIZE
      // ─────────────────────────────────────────
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px
        'xs': ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        'sm': ['0.875rem', { lineHeight: '1.375rem' }], // 14px
        'base': ['0.9375rem', { lineHeight: '1.5rem' }], // 15px
        'lg': ['1.0625rem', { lineHeight: '1.625rem' }], // 17px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
      },

      // ─────────────────────────────────────────
      // BORDER RADIUS
      // ─────────────────────────────────────────
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '24px',
        '3xl': '32px',
      },

      // ─────────────────────────────────────────
      // BOX SHADOW
      // ─────────────────────────────────────────
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'md': '0 4px 16px rgba(0, 0, 0, 0.5)',
        'lg': '0 8px 32px rgba(0, 0, 0, 0.6)',
        'xl': '0 16px 64px rgba(0, 0, 0, 0.7)',
        'glow-accent': '0 0 20px rgba(99, 102, 241, 0.20)',
        'glow-accent-strong': '0 0 40px rgba(99, 102, 241, 0.35)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.20)',
        'inner-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'inner-highlight-subtle': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },

      // ─────────────────────────────────────────
      // BACKDROP BLUR
      // ─────────────────────────────────────────
      backdropBlur: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '40px',
      },

      // ─────────────────────────────────────────
      // ANIMATION
      // ─────────────────────────────────────────
      animation: {
        'fade-in': 'fadeIn 180ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-up': 'slideUp 280ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-down': 'slideDown 280ms cubic-bezier(0, 0, 0.2, 1)',
        'scale-in': 'scaleIn 180ms cubic-bezier(0, 0, 0.2, 1)',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },

      // ─────────────────────────────────────────
      // KEYFRAMES
      // ─────────────────────────────────────────
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(99, 102, 241, 0.15)' },
          '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.30)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      // ─────────────────────────────────────────
      // TRANSITION TIMING
      // ─────────────────────────────────────────
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ─────────────────────────────────────────
      // TRANSITION DURATION
      // ─────────────────────────────────────────
      transitionDuration: {
        'fast': '120ms',
        'normal': '180ms',
        'slow': '280ms',
        'slower': '400ms',
      },

      // ─────────────────────────────────────────
      // SPACING
      // ─────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}
