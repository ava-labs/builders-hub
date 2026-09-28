// Staged paths go into a shell command: a filename carrying a space or a
// metacharacter would otherwise split into extra arguments, or run.
const shellArgs = (files) => files.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(' ');

module.exports = {
  // Console toolbox: ESLint with toolbox-specific rules + Prettier
  'components/toolbox/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --max-warnings 0',
  ],

  // Console design system: banned classes, color palette, anchor tags
  'components/toolbox/console/**/*.{ts,tsx}': (files) => [
    `./scripts/check-console-design.sh ${shellArgs(files)}`,
  ],

  // Audit marketplace: same design-system bans (zinc-only neutrals, no raw anchors)
  'components/audits/**/*.{ts,tsx}': (files) => [
    `./scripts/check-console-design.sh ${shellArgs(files)}`,
  ],

  // All TypeScript: type check (runs once, not per-file)
  '*.{ts,tsx}': () => 'tsc --noEmit',
};
