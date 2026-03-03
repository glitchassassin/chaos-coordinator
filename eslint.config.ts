import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["build/", ".react-router/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // React Router uses `throw new Response(...)` for 404s etc. — this is expected.
      "@typescript-eslint/only-throw-error": ["error", { allow: [{ from: "lib", name: "Response" }] }],
    },
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // server/app.ts dynamically imports the built React Router bundle at runtime —
  // TypeScript cannot resolve the path, so unsafe rules are disabled for that file.
  {
    files: ["server/app.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      // createNodeWebSocket returns plain functions; destructuring is safe.
      "@typescript-eslint/unbound-method": "off",
    },
  },
] as ReturnType<typeof tseslint.config>;
