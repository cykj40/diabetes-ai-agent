import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    tailwindcss,  // Enables Tailwind CSS
    autoprefixer  // Adds vendor prefixes for better cross-browser support
  ]
};

export default config;

