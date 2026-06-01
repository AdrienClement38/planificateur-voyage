import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "coverage", "android", "ios", "*.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      // Hooks : règles essentielles de React.
      // Code base avec quelques `any` assumés (server.ts, réponses API) :
      "@typescript-eslint/no-explicit-any": "off",
      // Variables/args/types préfixés par `_` ignorés (assertions de types, etc.).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  prettier,
);
