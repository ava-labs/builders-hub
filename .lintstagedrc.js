module.exports = {
  // Console toolbox: ESLint with toolbox-specific rules + Prettier
  'components/toolbox/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --max-warnings 0',
  ],

  // All TypeScript: type check (runs once, not per-file)
  '*.{ts,tsx}': () => 'tsc --noEmit',
};
