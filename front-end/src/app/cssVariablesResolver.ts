import type { CSSVariablesResolver } from '@mantine/core';

/**
 * Nâng độ tương phản của text "dimmed" để đạt WCAG 2.2 AA (1.4.3 — tối thiểu 4.5:1).
 *
 * Mặc định Mantine đặt `--mantine-color-dimmed` = gray.6 (#868e96) cho giao diện sáng
 * và một xám nhạt (#828282) cho tối. Audit axe (xem docs/plans/261116-2309-...) đo được
 * 3.17–4.03:1 ở trang Collection và Chi tiết 2D — dưới ngưỡng. Làm đậm/sáng hơn ở đây
 * khắc phục đồng loạt mọi chỗ dùng `c="dimmed"` mà không phải sửa từng component.
 */
export const auraCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  // Sáng: xám đậm hơn, đạt ≥4.5:1 trên cả nền trắng (#fff) lẫn nền thẻ ngà (#fff9f0).
  light: { '--mantine-color-dimmed': '#5c636e' },
  // Tối: xám sáng hơn, đạt ≥4.5:1 trên nền tối (#242424).
  dark: { '--mantine-color-dimmed': '#a1a8b3' },
});
