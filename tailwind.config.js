/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'main': '#39d0c4',
          'main-dark': '#2aa79b',
          'secondary': '#d03945',
          'fill': '#f5f5f5',
          'text-dark': '#00171f',
          'accent': '#f29e4c',
        },
        fontFamily: {
          'inter': ['Inter', 'sans-serif'],
        },
        backgroundImage: {
          'hero-pattern': 'radial-gradient(hsla(0, 0%, 0%, 0.05) 1px, transparent 1px)',
        },
        backgroundSize: {
          'dots': '20px 20px',
        },
        boxShadow: {
          'glow': '0 0 25px rgba(57, 208, 196, 0.4), 0 0 50px rgba(57, 208, 196, 0.2)',
        }
      },
    },
    plugins: [],
  }