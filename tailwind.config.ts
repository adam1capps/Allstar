import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand tokens — swap these for the real Allstar / Roof MRI palette.
        brand: {
          navy: "#0b2545",
          blue: "#13a0e6",
          slate: "#3d5a80",
          ink: "#1a1a1a",
          mist: "#eef4fb",
        },
        severity: {
          low: "#2e9e5b",
          moderate: "#e0a10a",
          high: "#d1495b",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
