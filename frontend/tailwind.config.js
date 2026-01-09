/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'kurz-bg': '#f0f2f5',
        'kurz-blue': '#2d34a4',
        'kurz-cyan': '#00f2ff',
        'kurz-pink': '#ff0095',
        'kurz-yellow': '#ffe600',
        'kurz-orange': '#ff6b00',
        'kurz-green': '#00ff88',
        'kurz-purple': '#7a00ff',
        'kurz-dark': '#1a1a2e'
      },
      fontFamily: {
        'sans': ['Outfit', 'sans-serif'],
        'display': ['Montserrat', 'sans-serif']
      },
      borderWidth: {
        '3': '3px',
        '4': '4px'
      },
      boxShadow: {
        'kurz': '6px 6px 0px #1a1a2e',
        'kurz-sm': '3px 3px 0px #1a1a2e'
      }
    }
  },
  plugins: []
}
