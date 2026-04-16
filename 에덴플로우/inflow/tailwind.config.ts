import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6C63FF",
        "primary-dark": "#4B44CC",
        accent: "#FF6584",
        "text-1": "#111111",
        "text-2": "#555555",
        "text-3": "#999999",
        "bg-1": "#FFFFFF",
        "bg-2": "#F4F4F8",
        "bg-3": "#F0F0F6",
        border: "#E5E5EF",
      },
      borderRadius: {
        card: "20px",
        btn: "12px",
        badge: "8px",
        tab: "10px",
        input: "12px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.06)",
      },
      fontFamily: {
        sans: ["Pretendard", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
