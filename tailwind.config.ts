import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // intel-terminal palette
        bg: '#07080c',
        'bg-2': '#0b0d13',
        surface: '#10131c',
        'surface-2': '#161a25',
        'surface-3': '#1d2231',
        'surface-hover': '#161a25', // legacy alias = surface-2
        border: '#232a3a',
        'border-soft': '#1a2030',
        'border-strong': '#34405a',
        text: {
          DEFAULT: '#d6dae6',
          secondary: '#8a93a8',
          muted: '#5b6378',
          faint: '#3d4458',
        },
        // signal colors
        green: '#2ee37a',
        amber: '#f5b041',
        orange: '#ff7f3f',
        red: '#ff4d5e',
        cyan: '#4cd6ff',
        violet: '#a78bff',
        accent: '#2ee37a', // accent re-targeted to green for ops feel
        // legacy sig-N aliases used by SignificanceDot / RiskBadge
        sig: {
          1: '#5b6378',
          2: '#2ee37a',
          3: '#f5b041',
          4: '#ff7f3f',
          5: '#ff4d5e',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        // ops-console preference: hard 2px corners
        DEFAULT: '2px',
      },
    },
  },
  plugins: [],
};
export default config;
