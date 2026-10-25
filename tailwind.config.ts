import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: '#0D9488', // Education Teal
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#2DD4BF',
          foreground: '#0F172A',
        },
        accent: {
          DEFAULT: '#D97706', // Amber CTA
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        ring: '#0D9488',
      },
      fontFamily: {
        sans: ['Outfit', 'Work Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
