import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",        // Next.js 15 App Router
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",      // For legacy Next.js projects
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // All reusable UI components
    "./layouts/**/*.{js,ts,jsx,tsx,mdx}",    // Optional: If you use layouts
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",        // Optional: Utility functions
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)", // Customizable theme colors via CSS variables
        foreground: "var(--foreground)",
        primary: "#1E40AF", // Example custom color
        secondary: "#9333EA",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Example font
      },
    },
  },
  plugins: [],
} satisfies Config;


