/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0472DF",
          "blue-dark": "#035DB6",
          "blue-light": "#E6F3FC",
          teal: "#04A793",
          "teal-dark": "#038575",
          "teal-light": "#E6F7F5",
          navy: "#0F2A44",
          "navy-light": "#163554",
          "navy-muted": "#1E4468",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
