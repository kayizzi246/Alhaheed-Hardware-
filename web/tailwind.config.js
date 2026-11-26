/**
 * The panel's design system, as Tailwind's config.
 *
 * Every colour is a CSS variable rather than a literal, because the
 * theme switches at runtime: the dark palette is re-pitched, not
 * inverted, and a flipped light theme always looks like a mistake.
 * Tailwind only needs to know the variable's name; `app/globals.css`
 * decides what it holds.
 *
 * The names are the shop's, not shadcn's defaults — `surface` and
 * `ink` say what they are on a screen somebody works at all day, where
 * "card" and "foreground" do not.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
        },
        // What sits under white text. Apart from `brand`, which is for
        // text and marks: in the dark theme that has to be pale, and white
        // on pale blue cannot be read.
        fill: {
          DEFAULT: 'rgb(var(--fill) / <alpha-value>)',
          dark: 'rgb(var(--fill-dark) / <alpha-value>)',
        },
        'on-fill': 'rgb(var(--on-fill) / <alpha-value>)',
        navy: {
          DEFAULT: 'rgb(var(--navy) / <alpha-value>)',
          deep: 'rgb(var(--navy-deep) / <alpha-value>)',
          soft: 'rgb(var(--navy-soft) / <alpha-value>)',
        },

        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          sunk: 'rgb(var(--surface-sunk) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          firm: 'rgb(var(--border-firm) / <alpha-value>)',
        },

        ink: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          2: 'rgb(var(--text-2) / <alpha-value>)',
          muted: 'rgb(var(--muted) / <alpha-value>)',
          faint: 'rgb(var(--faint) / <alpha-value>)',
        },

        ok: { DEFAULT: 'rgb(var(--green) / <alpha-value>)', bg: 'rgb(var(--green-bg) / <alpha-value>)' },
        bad: { DEFAULT: 'rgb(var(--red) / <alpha-value>)', bg: 'rgb(var(--red-bg) / <alpha-value>)' },
        warn: { DEFAULT: 'rgb(var(--amber) / <alpha-value>)', bg: 'rgb(var(--amber-bg) / <alpha-value>)' },
        info: { DEFAULT: 'rgb(var(--blue) / <alpha-value>)', bg: 'rgb(var(--blue-bg) / <alpha-value>)' },
      },

      fontFamily: {
        // Set in app/layout.js.
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // One family now. 'display' stays as a name so the markup that
        // asks for it keeps working, and so a second face can be put
        // back in one line if it is ever wanted.
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },

      // The built-in easings are too soft to feel deliberate.
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },

      spacing: { rail: 'var(--sidebar-w)' },

      keyframes: {
        'pop-in': {
          // From .96, never 0 — nothing in the world appears out of nothing.
          from: { opacity: '0', transform: 'scale(.96) translateY(-4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        /**
         * The same entrance, for something centred with a translate.
         *
         * `pop-in` ends on `transform: none`, and with fill-mode both
         * that final value sticks — wiping out the
         * `-translate-x-1/2 -translate-y-1/2` that put the dialog in
         * the middle. The box then sat half its own width right and
         * half its height low, which is exactly where it was landing.
         * So the centring travels inside the keyframe.
         */
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(.96)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '50%': { opacity: '.55' },
        },
      },
      animation: {
        'pop-in': 'pop-in 160ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'dialog-in': 'dialog-in 170ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'rise-in': 'rise-in 220ms cubic-bezier(0.23, 1, 0.32, 1) both',
        shimmer: 'shimmer 1.1s linear infinite',
      },
    },
  },
  plugins: [],
};
