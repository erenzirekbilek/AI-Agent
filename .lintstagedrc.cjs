module.exports = {
  'app/**/*.{ts,tsx}': () => 'npx tsc --noEmit -p app/tsconfig.json',
  'frontend/**/*.{ts,tsx}': () => 'npx tsc --noEmit -p frontend/tsconfig.json',
};
