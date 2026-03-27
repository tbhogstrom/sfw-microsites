/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Shared neutrals (used by all sites)
        neutral: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        // Accent color via CSS custom property (per-site)
        accent: {
          DEFAULT: 'var(--color-accent, #a1b770)',
          light: 'var(--color-accent-light, #c5d4a0)',
          dark: 'var(--color-accent-dark, #7a8f52)',
        },
        // Keep legacy colors during migration
        primary: '#a1b770',
        secondary: '#900',
        dark: '#000',
        light: '#fff',
        gray: {
          light: '#f3f1ee',
          border: '#726855',
        },
      },
      fontFamily: {
        heading: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Inter', 'Poppins', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        base: '18px',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        elevated: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
