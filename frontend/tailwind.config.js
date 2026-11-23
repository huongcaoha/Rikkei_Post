/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rikkei: {
          primary: '#e02424',
          secondary: '#1c2434',
          accent: '#ff5c00',
          light: '#f9fafb'
        }
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  }
}
