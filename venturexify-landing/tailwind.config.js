/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        shine: "shine var(--duration) infinite linear",
        "border-beam": "border-beam var(--duration, 6s) linear infinite var(--delay, 0s)",
      },
      keyframes: {
        shine: {
          "0%": { "background-position": "0% 0%" },
          "50%": { "background-position": "100% 100%" },
          to: { "background-position": "0% 0%" },
        },
        "border-beam": {
          "0%": { "offset-distance": "0%" },
          "100%": { "offset-distance": "100%" },
        },
      },
    },
  },
  plugins: [],
};
