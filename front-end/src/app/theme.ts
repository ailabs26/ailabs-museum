import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Màu thương hiệu Aura (có thể chỉnh sau). Tương phản đạt WCAG AA cho text chính.
const aura: MantineColorsTuple = [
  '#eef3ff',
  '#dce4f5',
  '#b9c7e2',
  '#94a8d0',
  '#748dc0',
  '#5f7cb7',
  '#5474b4',
  '#44639f',
  '#3a5890',
  '#2c4b80',
];

/** Theme Mantine dùng chung cho Admin CMS + Client. */
export const theme = createTheme({
  primaryColor: 'aura',
  colors: { aura },
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: '700' },
  cursorType: 'pointer',
});
