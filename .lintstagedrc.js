module.exports = {
  // Console toolbox: ESLint with toolbox-specific rules + Prettier
  'components/toolbox/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --max-warnings 0',
  ],

  // Console infrastructure (step-flow, sidebar, etc.): Prettier
  'components/console/**/*.{ts,tsx}': [
    'prettier --write',
  ],

  // Console design system: banned classes, color palette, anchor tags
  'components/toolbox/console/**/*.{ts,tsx}': (files) => [
    `./scripts/check-console-design.sh ${files.join(' ')}`,
  ],

  // All TypeScript: type check (runs once, not per-file)
  '*.{ts,tsx}': () => 'tsc --noEmit',
};
