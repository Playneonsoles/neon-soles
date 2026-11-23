import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0B0F1A",
        neon: "#39FF88",
        epic: "#8B5CF6",
        rare: "#22D3EE",
        legend: "#FBBF24",
      },
      fontFamily: { display: ["var(--font-display)", "sans-serif"], sans: ["var(--font-body)", "system-ui", "sans-serif"] },
      boxShadow: { neon: "0 0 24px rgba(57,255,136,.45)" },
    },
  },
  plugins: [],
} satisfies Config;
