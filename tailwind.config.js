/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-roboto)", "Roboto", "system-ui", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "Roboto Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
