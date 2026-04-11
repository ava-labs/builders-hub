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
  // Rule 1 & 2: Toolbox-wide — block direct wagmi useWalletClient
  //             and warn on console.log.
  //
  //             Hooks and contexts are EXCLUDED from the wagmi
  //             restriction because they are the wrapper layer that
  //             legitimately calls useWalletClient.
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
      // Block wagmi's useWalletClient — use the project wrapper instead.
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

      // Warn on console.log but allow console.warn / console.error.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ---------------------------------------------------------------
  // Hooks and contexts still get the no-console rule (but NOT the
  // wagmi restriction).
  // ---------------------------------------------------------------
  {
    files: [
      "components/toolbox/hooks/**/*.ts",
      "components/toolbox/hooks/**/*.tsx",
      "components/toolbox/contexts/**/*.ts",
      "components/toolbox/contexts/**/*.tsx",
    ],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
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
);
