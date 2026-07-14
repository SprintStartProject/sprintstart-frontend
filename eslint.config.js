import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
export default defineConfig(
  [
    globalIgnores([
      "dist",
      "dist_keycloak",
      "node_modules",
      "coverage",
      "src/keycloak-theme/**",
      "public/keycloak-theme/**",
      "public/keycloakify-dev-resources/**",
      "storybook-static/**"
    ]),

    {
      files: ["**/*.{ts,tsx}"],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        tseslint.configs.recommendedTypeChecked,
        reactPlugin.configs.flat.recommended,
        reactPlugin.configs.flat["jsx-runtime"],
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
        jsxA11y.flatConfigs.recommended,
      ],
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: {
          ...globals.browser,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/consistent-type-imports": [
          "warn",
          {
            prefer: "type-imports",
          },
        ],
        "prefer-const": "warn",
        eqeqeq: ["error", "always"],
        "no-console": [
          "warn",
          {
            allow: ["warn", "error"],
          },
        ],
      },
    },
    {
      files: ["**/*.test.{ts,tsx}", "tests/unit/setup/vitest.setup.ts"],
      rules: {
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/consistent-type-imports": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-empty-object-type": "off",
        "@typescript-eslint/no-unused-vars": "off"
      }
    },
    prettier,
  ]
);
