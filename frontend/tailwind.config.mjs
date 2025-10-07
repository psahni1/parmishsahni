/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Soft pastel palette
        blush: "#F8D7E3",
        mint: "#CDEDE4",
        sky: "#D8E7FF",
        peach: "#FFE3CF",
        lilac: "#E7D9FF",
        ink: "#0B0B0C",
      },
      boxShadow: {
        soft: "0 10px 30px -15px rgba(0,0,0,0.15)",
        insetGlass: "inset 0 1px 0 rgba(255,255,255,0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
