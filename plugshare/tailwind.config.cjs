// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-forest": "#173B32",
        "electric-lime": "#C7F36B",
        "warm-ivory": "#F5F3EB",
        "graphite": "#202923",
        "sage-grey": "#DCE4DA",
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
