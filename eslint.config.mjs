import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // Backend: plain JS
  {
    files: ["backend/src/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "no-throw-literal": "error",
      "no-return-await": "error",
    },
  },
  // Frontend: TypeScript + React
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["frontend/src/**/*.{ts,tsx}"],
  })),
  // Frontend: React rules
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  // Disable formatting rules — Prettier handles these
  prettier,
  {
    ignores: [
      "**/node_modules/**",
      "frontend/.next/**",
      "frontend/out/**",
      "frontend/build/**",
      "frontend/next-env.d.ts",
    ],
  },
];
