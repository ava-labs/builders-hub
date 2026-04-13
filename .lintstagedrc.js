module.exports = {
  // Console toolbox: ESLint with toolbox-specific rules + Prettier
  'components/toolbox/**/*.{ts,tsx}': [
    'prettier --write',
    'eslint --max-warnings 0',
  ],

  // Console design system: banned classes, color palette, anchor tags
  'components/toolbox/console/**/*.{ts,tsx}': (files) => [
    `./scripts/check-console-design.sh ${files.join(' ')}`,
  ],

  // API routes: ESLint + Prettier
  'app/api/**/*.ts': [
    'prettier --write',
    'eslint --max-warnings 0',
  ],

  // All TypeScript: type check (runs once, not per-file)
  '*.{ts,tsx}': () => 'tsc --noEmit',
};
