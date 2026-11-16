module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: ['./tsconfig.json', './tsconfig.scripts.json'], tsconfigRootDir: __dirname },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  // perf/ và load/ chạy ngoài Nest (harness, k6 runtime) nên không lint theo tsconfig.
  ignorePatterns: ['dist', 'node_modules', 'perf', 'load'],
};
