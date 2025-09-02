/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wall-echo': {
          'bg': '#0B1E3F',
          'yellow': '#FFD447',
          'white': '#F5F5F5',
          'dark': '#2E2E2E',
        }
      }
    },
  },
  plugins: [],
}