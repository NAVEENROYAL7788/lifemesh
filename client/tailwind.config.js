/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brandDark: '#0A192F',
        panelDark: '#112240',
        panelBorder: '#1E3A5F',
        electricCyan: '#06B6D4',
        emeraldGreen: '#10B981',
        amberWarn: '#F59E0B',
        roseAlert: '#F43F5E'
      }
    },
  },
  plugins: [],
}
