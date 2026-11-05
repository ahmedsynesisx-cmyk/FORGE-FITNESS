/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#F2B705',
        goldink: '#8A6400',
        butter: '#FFF6D6',
        cream: '#FFFCF2',
        charcoal: '#1C1C1E',
        slate: '#5F6368',
        line: '#ECE7D8',
        good: '#1B7A43',
        goodbg: '#E8F5EC',
        caution: '#A85400',
        cautionbg: '#FDF0E3',
        danger: '#C0262D',
        dangerbg: '#FCE8E8',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
