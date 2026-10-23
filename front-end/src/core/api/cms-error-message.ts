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
    case 404:
      return fallback || 'Không tìm thấy dữ liệu yêu cầu, bản ghi có thể đã bị xóa';
    case 413:
      return fallback || 'Dung lượng tệp tải lên vượt quá giới hạn cho phép';
    case 429:
      return fallback || 'Thao tác quá nhanh, vui lòng đợi ít phút rồi thử lại';
    case 400:
    case 422:
      return fallback || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại';
    case 0:
      return 'Mất kết nối máy chủ, vui lòng thử lại';
    default:
      return fallback || 'Có lỗi xảy ra, vui lòng thử lại';
  }
}
