import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const semantic = (name: string) => ({
  DEFAULT: token(name),
  subtle: token(`${name}-subtle`),
  border: token(`${name}-border`),
});

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          sunken: token('surface-sunken'),
          raised: token('surface-raised'),
        },
        border: { DEFAULT: token('border'), strong: token('border-strong') },
        input: token('input'),
        ring: token('ring'),
        muted: {
          DEFAULT: token('surface-muted'),
          foreground: token('muted-foreground'),
          subtle: token('subtle-foreground'),
        },
        // Components already use `text-subtle-foreground`; without this key that class generated no CSS.
        'subtle-foreground': token('subtle-foreground'),
        primary: {
          ...semantic('primary'),
          foreground: token('primary-foreground'),
          hover: token('primary-hover'),
        },
        accent: {
          ...semantic('accent'),
          strong: token('accent-strong'),
          foreground: token('accent-foreground'),
        },
        violet: semantic('violet'),
        success: semantic('success'),
        warning: semantic('warning'),
        danger: semantic('danger'),
        info: semantic('info'),
        pending: semantic('pending'),
        approved: semantic('approved'),
        rejected: semantic('rejected'),
        overdue: semantic('overdue'),
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
          hover: token('sidebar-hover'),
          active: token('sidebar-active'),
          border: token('sidebar-border'),
          accent: token('sidebar-accent'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.25rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.005em' }],
        '2xl': ['1.4375rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],
        '3xl': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '12px' },
      boxShadow: {
        xs: '0 1px 0 hsl(var(--shadow) / 0.04)',
        sm: '0 1px 2px hsl(var(--shadow) / 0.06)',
        card: '0 1px 2px hsl(var(--shadow) / 0.04), 0 2px 6px -2px hsl(var(--shadow) / 0.06)',
        lift: '0 2px 4px hsl(var(--shadow) / 0.05), 0 8px 20px -6px hsl(var(--shadow) / 0.12)',
        pop: '0 12px 32px -8px hsl(var(--shadow) / 0.24), 0 0 0 1px hsl(var(--border) / 1)',
      },
      spacing: { sidebar: '15rem', 'sidebar-collapsed': '3.5rem', topbar: '3.25rem' },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: { shimmer: 'shimmer 1.6s linear infinite' },
    },
  },
  plugins: [animate],
};

export default config;
