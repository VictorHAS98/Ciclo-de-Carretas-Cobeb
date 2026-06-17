/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        cobeb: {
          navy:   '#003DA5',
          blue:   '#1D6AD4',
          sky:    '#EBF5FF',
          card:   '#FFFFFF',
          border: '#BFDBFE',
          yellow: '#FFB81C',
          text:   '#1E3A6E',
        },
      },
    },
  },
  plugins: [],
}
