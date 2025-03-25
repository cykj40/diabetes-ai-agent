import type { Config } from "tailwindcss";

const config = {
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
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            a: {
              color: '#3182ce',
              '&:hover': {
                color: '#2c5282',
              },
            },
            strong: {
              color: 'inherit',
            },
            li: {
              margin: '0.25em 0',
            },
            h1: {
              color: 'inherit',
            },
            h2: {
              color: 'inherit',
            },
            h3: {
              color: 'inherit',
            },
            h4: {
              color: 'inherit',
            },
            p: {
              margin: '0.75em 0',
            },
            pre: {
              backgroundColor: '#1a1a1a',
              color: '#e5e5e5',
            },
            code: {
              color: 'inherit',
              backgroundColor: '#1a1a1a',
              padding: '0.2em 0.4em',
              borderRadius: '0.3em',
              fontSize: '0.9em',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config;

export default config;


