import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F2F4F3',
        ink: '#14202B',
        steel: '#4B5966',
        line: '#D3D9DC',
        plant: '#0B5C8A',
        compliant: '#1E7B4F',
        partial: '#C98A00',
        noncompliant: '#B3261E',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
