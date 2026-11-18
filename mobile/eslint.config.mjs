// ESLint flat config kế thừa quy ước web (eslint 9 + typescript-eslint),
// bổ sung preset Expo cho React Native (MOB-E1-02).
import expoConfig from 'eslint-config-expo/flat.js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/*', '.expo/*', 'node_modules/*', 'android/*', 'ios/*'] },
  expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
