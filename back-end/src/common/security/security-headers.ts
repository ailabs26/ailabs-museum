import type { HelmetOptions } from 'helmet';

/**
 * Header bảo mật cho toàn API (helmet). Khác mặc định ở CORP: front-end và API có thể khác site, và API đã được bảo vệ
 * bằng token + CORS, nên `same-origin` chỉ làm hỏng tải tài nguyên chứ không tăng bảo vệ. File media tự đặt CSP/CORP
 * chặt hơn ở MediaDeliveryController (giá trị đó ghi đè giá trị ở đây).
 */
export const SECURITY_HEADERS: HelmetOptions = {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
};
