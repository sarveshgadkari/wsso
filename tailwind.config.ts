import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand — WSSO purple
        primary: {
          50:  "#f6f0fb",
          100: "#eadcf5",
          200: "#d4b8ea",
          300: "#b889d9",
          400: "#9558c0",
          500: "#7a3aad",
          600: "#6B2D9B",
          700: "#512888",
          800: "#3f1f6a",
          900: "#2d164c",
          950: "#1a0c2e",
        },
        gold: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#FFD54A",
          500: "#F5C518",
          600: "#d4a80e",
          700: "#a37e08",
        },
        // Neutral grays — CSS variables so dark mode remaps every dashboard surface
        neutral: {
          50:  "rgb(var(--neutral-50) / <alpha-value>)",
          100: "rgb(var(--neutral-100) / <alpha-value>)",
          200: "rgb(var(--neutral-200) / <alpha-value>)",
          300: "rgb(var(--neutral-300) / <alpha-value>)",
          400: "rgb(var(--neutral-400) / <alpha-value>)",
          500: "rgb(var(--neutral-500) / <alpha-value>)",
          600: "rgb(var(--neutral-600) / <alpha-value>)",
          700: "rgb(var(--neutral-700) / <alpha-value>)",
          800: "rgb(var(--neutral-800) / <alpha-value>)",
          900: "rgb(var(--neutral-900) / <alpha-value>)",
          950: "rgb(var(--neutral-950) / <alpha-value>)",
        },
        // Semantic accent colors
        success: {
          50:  "#f0fdf4",
          500: "#22c55e",
          700: "#15803d",
        },
        warning: {
          50:  "#fffbeb",
          500: "#f59e0b",
          700: "#b45309",
        },
        danger: {
          50:  "#fef2f2",
          500: "#ef4444",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
