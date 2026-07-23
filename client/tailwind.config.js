/**
 * Tailwind config. Theme (device/light/dark) is chosen at runtime via `data-theme` on
 * <html> (see themeStore.js) — we do NOT use Tailwind's `dark:` variant; instead each
 * `--c-*` CSS variable below has both a light and dark value (src/index.css), so the same
 * semantic class (e.g. `bg-surface`) resolves correctly under either theme.
 * Color/shape/typescale/motion tokens map to CSS variables in src/index.css so components
 * never hardcode hex values — this is the app's Material 3 token layer.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens → CSS vars (see index.css). Use e.g. bg-surface, text-muted.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--c-bg-elevated) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',
        content: 'rgb(var(--c-content) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-strong': 'rgb(var(--c-brand-strong) / <alpha-value>)',
        'brand-content': 'rgb(var(--c-brand-content) / <alpha-value>)',
        tertiary: 'rgb(var(--c-tertiary) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // M3 full type scale, additive to Tailwind's default sizes (text-sm etc. still valid
      // for plain body copy). Use for elements taking on an explicit M3 role.
      fontSize: {
        '2xs': ['var(--type-label-sm-size)', { lineHeight: 'var(--type-label-sm-line)' }],
        'display-lg': ['var(--type-display-lg-size)', { lineHeight: 'var(--type-display-lg-line)', fontWeight: 'var(--type-display-lg-weight)' }],
        'display-md': ['var(--type-display-md-size)', { lineHeight: 'var(--type-display-md-line)', fontWeight: 'var(--type-display-md-weight)' }],
        'display-sm': ['var(--type-display-sm-size)', { lineHeight: 'var(--type-display-sm-line)', fontWeight: 'var(--type-display-sm-weight)' }],
        'headline-lg': ['var(--type-headline-lg-size)', { lineHeight: 'var(--type-headline-lg-line)', fontWeight: 'var(--type-headline-lg-weight)' }],
        'headline-md': ['var(--type-headline-md-size)', { lineHeight: 'var(--type-headline-md-line)', fontWeight: 'var(--type-headline-md-weight)' }],
        'headline-sm': ['var(--type-headline-sm-size)', { lineHeight: 'var(--type-headline-sm-line)', fontWeight: 'var(--type-headline-sm-weight)' }],
        'title-lg': ['var(--type-title-lg-size)', { lineHeight: 'var(--type-title-lg-line)', fontWeight: 'var(--type-title-lg-weight)' }],
        'title-md': ['var(--type-title-md-size)', { lineHeight: 'var(--type-title-md-line)', fontWeight: 'var(--type-title-md-weight)' }],
        'title-sm': ['var(--type-title-sm-size)', { lineHeight: 'var(--type-title-sm-line)', fontWeight: 'var(--type-title-sm-weight)' }],
        'body-lg': ['var(--type-body-lg-size)', { lineHeight: 'var(--type-body-lg-line)', fontWeight: 'var(--type-body-lg-weight)' }],
        'body-md': ['var(--type-body-md-size)', { lineHeight: 'var(--type-body-md-line)', fontWeight: 'var(--type-body-md-weight)' }],
        'body-sm': ['var(--type-body-sm-size)', { lineHeight: 'var(--type-body-sm-line)', fontWeight: 'var(--type-body-sm-weight)' }],
        'label-lg': ['var(--type-label-lg-size)', { lineHeight: 'var(--type-label-lg-line)', fontWeight: 'var(--type-label-lg-weight)' }],
        'label-md': ['var(--type-label-md-size)', { lineHeight: 'var(--type-label-md-line)', fontWeight: 'var(--type-label-md-weight)' }],
        'label-sm': ['var(--type-label-sm-size)', { lineHeight: 'var(--type-label-sm-line)', fontWeight: 'var(--type-label-sm-weight)' }],
      },
      // M3 shape scale. `xl`/`2xl` keep their pre-existing rem values (used pervasively as
      // .card/.btn/.input radii) so this is additive, not a breaking rename.
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
        none: 'var(--shape-none)',
        xs: 'var(--shape-xs)',
        sm: 'var(--shape-sm)',
        md: 'var(--shape-md)',
        lg: 'var(--shape-lg)',
        'lg-increased': 'var(--shape-lg-increased)',
        'xl-plus': 'var(--shape-xl)',
        'xl-increased': 'var(--shape-xl-increased)',
        '3xl': 'var(--shape-xxl)',
        full: 'var(--shape-full)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.4), 0 0 24px rgb(var(--c-brand) / 0.25)',
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'elevation-3': 'var(--shadow-elevation-3)',
      },
      transitionTimingFunction: {
        emphasized: 'var(--ease-emphasized)',
        'emphasized-decelerate': 'var(--ease-emphasized-decelerate)',
        'emphasized-accelerate': 'var(--ease-emphasized-accelerate)',
        standard: 'var(--ease-standard)',
        'standard-decelerate': 'var(--ease-standard-decelerate)',
        'standard-accelerate': 'var(--ease-standard-accelerate)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--c-brand) / 0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgb(var(--c-brand) / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--c-brand) / 0)' },
        },
      },
      animation: {
        // M3 "enter" transitions use the emphasized-decelerate curve (fast start, gentle
        // landing) — replaces plain ease-out with the spec-correct emphasized easing.
        'fade-in': 'fade-in var(--duration-medium) var(--ease-emphasized-decelerate)',
        'slide-up': 'slide-up var(--duration-medium) var(--ease-emphasized-decelerate)',
        'scale-in': 'scale-in var(--duration-short) var(--ease-emphasized-decelerate)',
        'pulse-ring': 'pulseRing 2s infinite',
      },
    },
  },
  plugins: [],
};
