// Thiết lập chung cho test (MOB-E14-01).
import '@testing-library/react-native/extend-expect';

// AsyncStorage không có native module trong Jest: dùng mock chính thức (bộ nhớ) cho mọi test.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
