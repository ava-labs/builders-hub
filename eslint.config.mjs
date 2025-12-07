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
      // Prettier integration
      "prettier/prettier": "warn",

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Next.js rules
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",

      // TypeScript rules - relaxed for gradual adoption
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
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "no-unused-expressions": "warn",
      curly: ["warn", "multi-line"],
      "no-throw-literal": "error",
      "no-return-await": "warn",
      "require-await": "warn",

      // A11y rules (warnings for gradual adoption)
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
];
