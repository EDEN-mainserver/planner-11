// @type {import('tailwindcss').Config}
const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Pretendard', 'sans-serif'] },
      colors: { primary: '#4f46e5' },
    },
  },
  plugins: [],
}
module.exports = config
