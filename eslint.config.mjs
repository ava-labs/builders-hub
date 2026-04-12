// @ts-check

import tseslint from "typescript-eslint";

/**
 * ESLint flat config — targeted rules for console toolbox conventions.
 *
 * This config does NOT enable a broad rule-set. It only enforces
 * project-specific constraints inside components/toolbox/.
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
  // Toolbox-wide: unused imports/vars + no console.log
  // ---------------------------------------------------------------
  {
    files: ["components/toolbox/**/*.ts", "components/toolbox/**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // Block unused imports and variables. Prefix with _ to opt out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Block console.log — use console.warn/error for legitimate logging.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // ---------------------------------------------------------------
  // Wagmi guard: block direct useWalletClient in consumer code.
  // Hooks and contexts are EXCLUDED because they are the wrapper
  // layer that legitimately calls useWalletClient.
  // ---------------------------------------------------------------
  {
    files: ["components/toolbox/**/*.ts", "components/toolbox/**/*.tsx"],
    ignores: [
      "components/toolbox/hooks/**",
      "components/toolbox/contexts/**",
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
              group: ["wagmi"],
              importNames: ["useWalletClient"],
              message:
                "Use useResolvedWalletClient from @/components/toolbox/hooks/useResolvedWalletClient instead. wagmi's useWalletClient returns undefined on custom L1 chains.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------
  // Rule 3: Console components only — block direct readContract
  //         from viem/actions (hooks that wrap it are exempt).
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
            // Carry forward the wagmi restriction so it isn't
            // silently dropped by this second config entry.
            {
              group: ["wagmi"],
              importNames: ["useWalletClient"],
              message:
                "Use useResolvedWalletClient from @/components/toolbox/hooks/useResolvedWalletClient instead. wagmi's useWalletClient returns undefined on custom L1 chains.",
            },
            {
              group: ["viem/actions"],
              importNames: ["readContract"],
              message:
                "Use the contract hooks (useValidatorManager, etc.) instead of direct readContract calls for consistent error handling.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------
  // Rule 4: Standalone validator flows must NOT import
  //         createChainStore — it leaks stale subnet IDs from the
  //         L1 creation wizard into unrelated flows.
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
          // Carry forward existing restrictions
          patterns: [
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
);
