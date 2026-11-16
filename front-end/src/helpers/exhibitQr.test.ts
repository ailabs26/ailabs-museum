import { describe, expect, it } from 'vitest';
import { exhibitQrSvg, exhibitShortUrl, publicSiteUrl, qrFileName, svgDataUrl } from './exhibitQr';

const ID = '10000000-0000-4000-8000-000000000001';

describe('liên kết mã QR', () => {
  it('địa chỉ gốc: ưu tiên cấu hình, bỏ dấu / cuối; thiếu thì dùng địa chỉ đang mở', () => {
    expect(publicSiteUrl('https://museum.example.com/', 'http://localhost:5173')).toBe('https://museum.example.com');
    expect(publicSiteUrl('  ', 'http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('liên kết cố định chỉ chứa id hiện vật', () => {
    expect(exhibitShortUrl(ID, 'https://museum.example.com')).toBe(`https://museum.example.com/e/${ID}`);
  });

  it('tên tệp bỏ dấu tiếng Việt; thiếu tên thì dùng id', () => {
    expect(qrFileName('Trống đồng Đông Sơn', ID, 'png')).toBe('ma-qr-trong-dong-dong-son.png');
    expect(qrFileName('', ID, 'svg')).toBe('ma-qr-10000000.svg');
  });
});

describe('ảnh mã QR', () => {
  it('sinh SVG và đóng gói được làm src của <img>', async () => {
    const svg = await exhibitQrSvg(exhibitShortUrl(ID, 'https://museum.example.com'));
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
    expect(svgDataUrl(svg)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });
});
