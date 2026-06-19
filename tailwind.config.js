/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cube: {
          white: '#f8fafc',
          yellow: '#facc15',
          red: '#ef4444',
          orange: '#f97316',
          blue: '#3b82f6',
          green: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
