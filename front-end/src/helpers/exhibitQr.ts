import { env } from '@/core/config/env';

/** Địa chỉ gốc của trang khách, không có `/` cuối. */
export function publicSiteUrl(configured: string = env.publicSiteUrl, origin: string = window.location.origin): string {
  return (configured.trim() || origin).replace(/\/+$/, '');
}

/** Liên kết cố định in trên mã QR: chỉ chứa id, nên đổi slug phòng hay chuyển phòng không làm hỏng mã đã in. */
export function exhibitShortUrl(exhibitId: string, base: string = publicSiteUrl()): string {
  return `${base}/e/${encodeURIComponent(exhibitId)}`;
}

/** Mức sửa lỗi M: chịu được vết bẩn/xước nhẹ trên bản in mà mã vẫn nhỏ gọn. */
const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 1 } as const;

/** SVG của mã QR (in sắc nét ở mọi cỡ). Thư viện chỉ tải khi cần, không làm nặng trang khách. */
export async function exhibitQrSvg(url: string): Promise<string> {
  const { toString } = await import('qrcode');
  return toString(url, { ...QR_OPTIONS, type: 'svg' });
}

/** PNG (data URL) của mã QR. */
export async function exhibitQrPng(url: string, width = 600): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(url, { ...QR_OPTIONS, width });
}

/** SVG dùng làm `src` của `<img>`, không cần chèn HTML thô. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Tên tệp tải về: bỏ dấu và ký tự đặc biệt, thiếu tên thì dùng id. */
export function qrFileName(name: string, exhibitId: string, extension: 'png' | 'svg'): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `ma-qr-${slug || exhibitId.slice(0, 8)}.${extension}`;
}
