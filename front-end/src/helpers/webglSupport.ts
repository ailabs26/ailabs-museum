/**
 * Kiểm tra nhanh khả năng dựng WebGL của thiết bị — dùng để quyết định có mount
 * cảnh 3D trang trí hay rơi về fallback 2D (ví dụ hero trang chủ).
 *
 * Chạy an toàn khi không có DOM (SSR/test): trả `false` thay vì ném lỗi.
 */
export function supportsWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
