/**
 * Tailwind, scoped so it cannot leak into wp-admin.
 *
 * `important: '#ah-app'` makes every utility win against WordPress's
 * own stylesheet without !important littered through the components,
 * and the preflight is off because resetting wp-admin's base styles
 * would wreck the menu and the admin bar around us.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  important: '#ah-app',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--ah-border))',
        input: 'hsl(var(--ah-input))',
        ring: 'hsl(var(--ah-ring))',
        background: 'hsl(var(--ah-background))',
        foreground: 'hsl(var(--ah-foreground))',
        primary: { DEFAULT: 'hsl(var(--ah-primary))', foreground: 'hsl(var(--ah-primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--ah-secondary))', foreground: 'hsl(var(--ah-secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--ah-destructive))', foreground: 'hsl(var(--ah-destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--ah-muted))', foreground: 'hsl(var(--ah-muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--ah-accent))', foreground: 'hsl(var(--ah-accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--ah-card))', foreground: 'hsl(var(--ah-card-foreground))' },
        success: { DEFAULT: 'hsl(var(--ah-success))', foreground: 'hsl(var(--ah-success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--ah-warning))', foreground: 'hsl(var(--ah-warning-foreground))' },
      },
      borderRadius: {
        lg: 'var(--ah-radius)',
        md: 'calc(var(--ah-radius) - 2px)',
        sm: 'calc(var(--ah-radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'ah-in': { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'scale(1)' } },
        'ah-shimmer': { to: { backgroundPosition: '-220% 0' } },
      },
      animation: {
        'ah-in': 'ah-in 160ms cubic-bezier(.23,1,.32,1)',
        'ah-shimmer': 'ah-shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
