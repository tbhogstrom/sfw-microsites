/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: '#a1b770',    // Olive green
        secondary: '#900',      // Dark red
        dark: '#000',
        light: '#fff',
        gray: {
          light: '#f3f1ee',
          border: '#726855',
        }
      },
      fontFamily: {
        heading: ['Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Poppins', 'Muli', 'sans-serif'],
      },
      fontSize: {
        base: '18px',
      },
    },
  },
  plugins: [],
}
