import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      ".expo/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**"
    ]
  },
  {
    files: ["*.js", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        module: "readonly",
        process: "readonly",
        URL: "readonly",
        require: "readonly"
      }
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
