/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primaryTextColor: "var(--primary-text-color)",
        secondaryTextColor: "var(--secondary-text-color)",
        whiteColor: "var(--white-text-color)",
        blackBackground: "var(--black-background-color)",
        defaultBorderColor: "var(--default-border-color)",
        defaultBackground: "var(--default-background-color)",
      },
    },
  },
  plugins: [],
};
