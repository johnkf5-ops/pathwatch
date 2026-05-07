import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#12121A',
        'surface-hover': '#1A1A25',
        border: '#2A2A35',
        text: {
          DEFAULT: '#E8E8ED',
          secondary: '#8888A0',
          muted: '#555570',
        },
        accent: '#3B82F6',
        sig: {
          1: '#6B7280',
          2: '#4ADE80',
          3: '#FFB800',
          4: '#FF6B35',
          5: '#FF3B3B',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
