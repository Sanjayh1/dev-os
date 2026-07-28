import type { Config } from 'tailwindcss'

// Tokens sourced from skills/design-system/SKILL.md — the sole authoritative
// design system for ContractIQ. Do not add colors/spacing/fonts outside this file.
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#112E81',
          hover: '#0E276E',
        },
        secondary: {
          DEFAULT: '#4647AE',
          hover: '#3B3C96',
        },
        accent: {
          DEFAULT: '#AACCD6',
          light: '#D8E8ED',
        },
        surface: {
          DEFAULT: '#F1F5F9',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#64748B',
        },
        bg: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
        info: '#0284C7',
        confidence: {
          high: '#16A34A',
          medium: '#84CC16',
          low: '#F59E0B',
          critical: '#DC2626',
        },
        status: {
          completed: '#16A34A',
          processing: '#F59E0B',
          failed: '#DC2626',
          draft: '#64748B',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        display: ['32px', { fontWeight: '700' }],
        h1: ['28px', { fontWeight: '700' }],
        h2: ['24px', { fontWeight: '600' }],
        h3: ['20px', { fontWeight: '600' }],
        h4: ['18px', { fontWeight: '600' }],
        'body-lg': ['16px', { fontWeight: '400' }],
        body: ['14px', { fontWeight: '400' }],
        small: ['12px', { fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '40px',
        '3xl': '48px',
      },
      borderRadius: {
        card: '12px',
        input: '8px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
      },
    },
  },
  plugins: [],
}

export default config
