// @ts-check

import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";

/**
 * ESLint flat config: targeted rules for console toolbox and explorer
 * conventions.
 *
 * This config does NOT enable a broad rule-set. It only enforces
 * project-specific constraints inside components/toolbox/ and the
 * explorer's files (EXPLORER below).
 *
 * IMPORTANT: no-restricted-imports can only be defined ONCE per file scope
 * in flat config (later blocks override earlier ones). All import restrictions
 * for the same file scope must be consolidated into a single block.
 */

// ---------------------------------------------------------------
// Explorer: each shared helper has one home, no code goes unused,
// and no file grows past a size cap.
// ---------------------------------------------------------------

/** the explorer's files (the Explorer CI workflow lists the same paths) */
const EXPLORER = [
  "components/explorer-v2/**/*.{ts,tsx}",
  "components/explorer/**/*.{ts,tsx}",
  "lib/explorer-query/**/*.ts",
  "lib/explorer-clickhouse.ts",
  "lib/pchain-explorer.ts",
  "app/(home)/explorer/**/*.{ts,tsx}",
  "app/api/explorer/**/*.ts",
];

/** a file of this repo, as text */
const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

/** the names a file exports with `export const` or `export function` */
const exportsOf = (file) =>
  [...read(file).matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);

/**
 * The shared helpers' homes, each with its shared names. Every other
 * explorer file imports these names and defines none of them at its top
 * level. To share a new helper, export it from a home.
 */
const HOMES = {
  "lib/explorer-query/values.ts": exportsOf("./lib/explorer-query/values.ts"),
  "components/explorer-v2/format.ts": exportsOf("./components/explorer-v2/format.ts"),
  "lib/explorer-query/edges.ts": ["msOf"],
};

/** no-restricted-syntax entries that stop a top-level definition of a name from a home other than `own` */
const helperCopies = (own) =>
  Object.entries(HOMES)
    .filter(([home]) => home !== own)
    .flatMap(([home, names]) => {
      const name = `/^(?:${names.join("|")})$/`;
      const top = ":matches(Program, Program > ExportNamedDeclaration)";
      const message = `${home} defines this name: import it from there, or give your own a name that says how it differs.`;
      return [
        { selector: `${top} > VariableDeclaration > VariableDeclarator[id.name=${name}]`, message },
        { selector: `${top} > FunctionDeclaration[id.name=${name}]`, message },
      ];
    });

/**
 * The size cap: 600 lines of code a file, blank and comment lines not
 * counted. A file that was over the cap when the cap came in holds a
 * ceiling at its size then, in scripts/explorer-size-ceilings.json. A
 * ceiling only comes down (tests/unit/explorer/size-ceilings.test.ts).
 * To add code to a file at its ceiling, first move a part of it to a
 * new file.
 */
const SIZE_CAP = 600;
const SIZE_CEILINGS = JSON.parse(read("./scripts/explorer-size-ceilings.json"));
const maxLines = (max) => ["error", { max, skipBlankLines: true, skipComments: true }];

/** a path as a glob that matches only itself: a route folder such as [chainId] holds glob characters */
const literal = (file) => file.replace(/[[\]{}()*?!+@]/g, "\\$&");

/**
 * Rules that do nothing, under the names of two plugins that are not
 * installed (react-hooks, @next/next). The explorer's inline disable
 * comments name these rules, and ESLint stops at a rule it cannot find.
 */
const stub = (...rules) => ({
  rules: Object.fromEntries(rules.map((r) => [r, { meta: { schema: false }, create: () => ({}) }])),
});

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

  // ---------------------------------------------------------------
  // Explorer: see EXPLORER, HOMES and SIZE_CAP above
  // ---------------------------------------------------------------
  {
    files: EXPLORER,
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": stub("exhaustive-deps"),
      "@next/next": stub("no-img-element"),
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    // a stub reports nothing, so ESLint would call each disable comment for one unused
    linterOptions: {
      reportUnusedDisableDirectives: "off",
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
      "no-restricted-syntax": ["error", ...helperCopies()],
      "max-lines": maxLines(SIZE_CAP),
    },
  },

  // a home defines its own names
  ...Object.keys(HOMES).map((home) => ({
    files: [home],
    rules: { "no-restricted-syntax": ["error", ...helperCopies(home)] },
  })),

  // a file over the cap holds at its ceiling
  ...Object.entries(SIZE_CEILINGS).map(([file, max]) => ({
    files: [literal(file)],
    rules: { "max-lines": maxLines(max) },
  })),
);
