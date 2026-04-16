import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#f3f1ff',
          100: '#e6e3ff',
          200: '#d0ccff',
          300: '#b2a9ff',
          400: '#9187ff',
          500: '#6c63ff',
          600: '#4b44cc',
          700: '#3a35a0',
          800: '#2b2778',
          900: '#1d1a50',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(0,0,0,0.06)',
        'plan': '0 8px 30px rgb(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
export default config
