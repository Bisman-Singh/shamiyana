import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.tsx"],
    extends: [
      eslintReact.configs["strict-type-checked"],
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.configs.strict,
    ],
    rules: {
      "jsx-a11y-x/label-has-associated-control": ["error", { assert: "either", depth: 4 }],
      // a tab panel is a Tab stop in the WAI-ARIA tabs pattern, as in the plugin's recommended set
      "jsx-a11y-x/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tabpanel"] }],
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      complexity: ["error", 10],
      eqeqeq: ["error", "always"],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Model and user text is rendered as text only.",
        },
      ],
    },
  },
  {
    files: ["lib/server/log.ts"],
    rules: { "no-console": ["error", { allow: ["info", "warn", "error"] }] },
  },
  {
    files: ["tests/**", "e2e/**", "scripts/**"],
    // tests feed documentation-range addresses (RFC 5737, RFC 3849) to the client address parser
    rules: { "max-lines-per-function": "off", "sonarjs/no-hardcoded-ip": "off" },
  },
  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
