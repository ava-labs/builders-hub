import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-plugin-prettier";

export default [
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.generated.ts",
      "**/prisma/generated/**",
      "**/.fumadocs/**",
      "**/public/**",
      "**/artifacts/**",
      // Content directories contain MDX that shouldn't be linted as TS
      "**/content/**",
      "**/upcoming_content/**",
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TypeScript configs
  ...tseslint.configs.recommended,

  // React & JSX A11y configs
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": nextPlugin,
      prettier,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        EventTarget: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLCanvasElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        FocusEvent: "readonly",
        TouchEvent: "readonly",
        ClipboardEvent: "readonly",
        DragEvent: "readonly",
        PointerEvent: "readonly",
        WheelEvent: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        atob: "readonly",
        btoa: "readonly",
        crypto: "readonly",
        performance: "readonly",
        location: "readonly",
        history: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        getComputedStyle: "readonly",
        matchMedia: "readonly",
        // Node.js globals
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        globalThis: "readonly",
        // TypeScript/ESM globals
        NodeJS: "readonly",
        RequestInit: "readonly",
        BodyInit: "readonly",
        HeadersInit: "readonly",
        RequestInfo: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        ReadableStream: "readonly",
        WritableStream: "readonly",
        TransformStream: "readonly",
        // BigInt
        BigInt: "readonly",
        // Map/Set
        Map: "readonly",
        Set: "readonly",
        WeakMap: "readonly",
        WeakSet: "readonly",
        // Promise
        Promise: "readonly",
        // Symbol
        Symbol: "readonly",
        // Proxy/Reflect
        Proxy: "readonly",
        Reflect: "readonly",
        // Intl
        Intl: "readonly",
        // Error types
        Error: "readonly",
        TypeError: "readonly",
        RangeError: "readonly",
        SyntaxError: "readonly",
        ReferenceError: "readonly",
        // JSON
        JSON: "readonly",
        // Math
        Math: "readonly",
        // Number
        Number: "readonly",
        isNaN: "readonly",
        isFinite: "readonly",
        parseFloat: "readonly",
        parseInt: "readonly",
        // String
        String: "readonly",
        // Array
        Array: "readonly",
        // Object
        Object: "readonly",
        // Date
        Date: "readonly",
        // RegExp
        RegExp: "readonly",
        // Boolean
        Boolean: "readonly",
        // Function
        Function: "readonly",
        // undefined/null
        undefined: "readonly",
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Prettier integration - enforce formatting
      "prettier/prettier": "error",

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "warn", // Demoted for gradual adoption
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn", // Demoted for gradual adoption

      // Next.js rules
      "@next/next/no-html-link-for-pages": "warn", // Demoted for gradual adoption
      "@next/next/no-img-element": "warn", // Demoted for gradual adoption

      // TypeScript rules - demoted for gradual adoption
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",

      // General rules
      "no-console": ["warn", { allow: ["warn", "error", "info"] }], // Demoted
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "warn", // Demoted for gradual adoption
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "no-unused-expressions": "warn",
      curly: ["error", "multi-line"],
      "no-throw-literal": "warn", // Demoted for gradual adoption
      "no-prototype-builtins": "warn", // Demoted for gradual adoption
      "no-constant-binary-expression": "warn", // Demoted for gradual adoption
      "no-constant-condition": "warn", // Demoted for gradual adoption
      "@typescript-eslint/no-unsafe-function-type": "warn", // Demoted for gradual adoption
      "no-return-await": "warn",
      "require-await": "warn",

      // A11y rules - demoted for gradual adoption
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/heading-has-content": "warn",
    },
  },

  // MDX files - minimal linting
  {
    files: ["**/*.mdx"],
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // Test files - relaxed rules
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // Config files - relaxed rules
  {
    files: [
      "*.config.{js,mjs,ts}",
      "next.config.{js,mjs,ts}",
      "tailwind.config.{js,ts}",
      "postcss.config.{js,mjs}",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },

  // Server files - allow console for logging
  {
    files: ["**/server/**", "**/api/**", "**/scripts/**"],
    rules: {
      "no-console": "off",
    },
  },

  // Node.js script files (.mjs, .mts) - add Node.js globals and relax rules
  {
    files: ["**/*.mjs", "**/*.mts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-useless-catch": "warn",
    },
  },

  // Utils and remote content scripts - relax unused vars for caught errors
  {
    files: ["**/utils/**/*.mts", "**/utils/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Files with known hook issues that need refactoring - demote for gradual adoption
  {
    files: [
      "**/components/console/step-flow.tsx",
      "**/components/quizzes/hooks/useBadgeAward.ts",
      "**/components/tools/common/api/**",
    ],
    rules: {
      "react-hooks/rules-of-hooks": "warn",
    },
  },

  // Toolbox components - relax unused expressions for patterns with side effects
  {
    files: ["**/components/toolbox/**/*.tsx", "**/components/toolbox/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
];
