import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Effect callbacks must use a block body. An implicit return
      // (`useEffect(() => window.scrollTo(0, 0), [])`) hands the call's
      // return value to React as the cleanup function; browser extensions
      // that patch globals to return values then crash the whole tree with
      // "TypeError: n is not a function" on unmount (site-wide blank pages
      // in production — see commit 58391ec).
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^(useEffect|useLayoutEffect|useInsertionEffect)$/] > ArrowFunctionExpression[body.type!='BlockStatement']",
          message:
            "Effect callbacks must have a block body ({ ... }). An implicit return becomes React's cleanup function and crashes when the called API returns a value (e.g. an extension-patched window.scrollTo).",
        },
      ],
    },
  },
);
