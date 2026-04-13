// @ts-check

import tseslint from "typescript-eslint";

/**
 * ESLint flat config — targeted rules for console toolbox conventions.
 *
 * This config does NOT enable a broad rule-set. It only enforces
 * project-specific constraints inside components/toolbox/.
 *
 * IMPORTANT: no-restricted-imports can only be defined ONCE per file scope
 * in flat config (later blocks override earlier ones). All import restrictions
 * for the same file scope must be consolidated into a single block.
 */

export default tseslint.config(
  // ---------------------------------------------------------------
  // Base: register @typescript-eslint plugin so inline disable
  // comments (e.g. @typescript-eslint/no-explicit-any) don't trigger
  // "Definition for rule … was not found" errors. No rules enabled.
  // ---------------------------------------------------------------
  {
    files: ["components/toolbox/**/*.ts", "components/toolbox/**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
  },

  // ---------------------------------------------------------------
  // Toolbox-wide: unused imports/vars + no console.log + wagmi guard
  // ---------------------------------------------------------------
  {
    files: ["components/toolbox/**/*.ts", "components/toolbox/**/*.tsx"],
    ignores: [
      "components/toolbox/hooks/**",
      "components/toolbox/contexts/**",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "no-console": ["error", { allow: ["warn", "error"] }],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["wagmi"],
              importNames: ["useWalletClient"],
              message:
                "Use useResolvedWalletClient instead. wagmi's useWalletClient returns undefined on custom L1 chains.",
            },
          ],
        },
      ],
    },
  },

  // Hooks and contexts ARE allowed to use wagmi directly — only
  // need unused-vars and no-console for those.
  {
    files: [
      "components/toolbox/hooks/**/*.ts",
      "components/toolbox/hooks/**/*.tsx",
      "components/toolbox/contexts/**/*.ts",
      "components/toolbox/contexts/**/*.tsx",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // ---------------------------------------------------------------
  // Console components: all import restrictions in ONE block.
  // (deep relative imports, readContract, wagmi — consolidated)
  // ---------------------------------------------------------------
  {
    files: [
      "components/toolbox/console/**/*.ts",
      "components/toolbox/console/**/*.tsx",
    ],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../**"],
              message:
                "Use @/ path aliases instead of deep relative imports (e.g. @/components/toolbox/components/...).",
            },
            {
              group: ["wagmi"],
              importNames: ["useWalletClient"],
              message:
                "Use useResolvedWalletClient instead.",
            },
            {
              group: ["viem/actions"],
              importNames: ["readContract"],
              message:
                "Use the contract hooks (useValidatorManager, etc.) instead of direct readContract calls.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------
  // Standalone validator flows: additional restriction on
  // createChainStore (leaks stale subnet IDs from creation wizard).
  // Must re-include all console patterns since this overrides the
  // block above for these specific paths.
  // ---------------------------------------------------------------
  {
    files: [
      "components/toolbox/console/permissioned-l1s/add-validator/**",
      "components/toolbox/console/permissioned-l1s/remove-validator/**",
      "components/toolbox/console/permissioned-l1s/change-weight/**",
      "components/toolbox/console/permissionless-l1s/stake/**",
      "components/toolbox/console/permissionless-l1s/delegate/**",
      "components/toolbox/console/permissionless-l1s/withdraw/**",
    ],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/toolbox/stores/createChainStore",
              message:
                "Standalone validator flows must not read from createChainStore — it persists stale state from the L1 creation wizard. Use the flow's own store instead.",
            },
          ],
          patterns: [
            {
              group: ["../../../**"],
              message:
                "Use @/ path aliases instead of deep relative imports.",
            },
            {
              group: ["wagmi"],
              importNames: ["useWalletClient"],
              message:
                "Use useResolvedWalletClient instead.",
            },
            {
              group: ["viem/actions"],
              importNames: ["readContract"],
              message:
                "Use the contract hooks instead of direct readContract calls.",
            },
          ],
        },
      ],
    },
  },

  // ── API ROUTE RULES ──────────────────────────────────────────
  {
    files: ["app/api/**/*.ts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["error", "warn"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off", // TODO: tighten to "warn" after gradual type cleanup
    },
  },

  // ── CLIENT-SIDE API CALL ENFORCEMENT ─────────────────────────
  {
    files: ["components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ["components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api\\//]",
          message: "Use apiFetch() from @/lib/api/client instead of raw fetch('/api/...').",
        },
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw=/^\\/api\\//]",
          message: "Use apiFetch() from @/lib/api/client instead of raw fetch(`/api/...`).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message: "Use apiFetch() from @/lib/api/client instead of axios.",
            },
          ],
        },
      ],
    },
  },
);
