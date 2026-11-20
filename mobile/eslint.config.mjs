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
  {
    // React Three Fiber dùng thuộc tính Three.js trực tiếp trên JSX (<mesh>, <directionalLight>, ...).
    files: ['src/features/scene3d/**/*.tsx', 'src/features/ar/**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'metro.config.js', 'jest.config.js', 'babel.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
