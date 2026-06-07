import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        sand: "#fff7ed",
        accent: "#d97706",
        skyline: "#1d4ed8"
      }
    }
  },
  plugins: []
};

export default config;
