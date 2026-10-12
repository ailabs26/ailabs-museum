/**
 * Ánh xạ mã HTTP → thông điệp tiếng Việt thân thiện cho thao tác CMS.
 * Hàm thuần, không phụ thuộc UI — tách riêng để unit test độc lập.
 */
export function cmsErrorMessage(status: number, fallback?: string): string {
  switch (status) {
    case 409:
      return fallback || 'Nội dung đã bị thay đổi bởi người khác, vui lòng tải lại trang';
    case 403:
      return 'Bạn không đủ quyền thực hiện thao tác này';
    case 400:
    case 422:
      return fallback || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại';
    case 0:
      return 'Mất kết nối máy chủ, vui lòng thử lại';
    default:
      return fallback || 'Có lỗi xảy ra, vui lòng thử lại';
  }
}
