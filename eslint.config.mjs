// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.config.{js,mjs,cjs}",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // Disabled: NestJS resolves dependencies from runtime type metadata
      // (emitDecoratorMetadata). Forcing `import type` on a class that is
      // injected by type erases it at runtime and breaks DI. Correctness > style.
      "@typescript-eslint/consistent-type-imports": "off",
      "no-console": "warn",
      eqeqeq: ["error", "always"],
    },
  },
  prettier,
);
