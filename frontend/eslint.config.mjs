import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";

// Needed for new ESM config in Node:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bridge for older-style "extends" configs
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  // Pull in Prettier configs to keep formatting conflicts away
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ),

  {
    // Lint JS, TS, and TSX files
    files: ["**/*.{js,ts,tsx}"],
    ignores: ["node_modules", "dist", ".next"], // adjust as needed

    languageOptions: {
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json", // or remove if you don't use project references
      },
    },

    plugins: {
      "@typescript-eslint": typescriptPlugin,
      prettier: prettierPlugin,
    },

    rules: {
      // Make Prettier show as warnings rather than errors
      "prettier/prettier": "warn",

      // Turn off some of the more strict TypeScript ESLint rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_" },
      ],

      // Example: if you want to allow `console.log` in dev, leave it at 'warn' or 'off'
      "no-console": "warn",
    },
  },
];

export default config;

