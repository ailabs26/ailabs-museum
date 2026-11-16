export interface SitemapEntry {
  /** Đường dẫn tương đối của trang khách, bắt đầu bằng `/`. */
  path: string;
  lastmod?: Date | null;
}

/** Giới hạn của giao thức sitemap cho một tệp. */
export const SITEMAP_MAX_URLS = 50_000;

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] as string
));

/** Sitemap XML (sitemaps.org 0.9) với URL tuyệt đối theo địa chỉ trang khách. */
export function buildSitemapXml(siteUrl: string, entries: readonly SitemapEntry[]): string {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = entries.slice(0, SITEMAP_MAX_URLS).map(({ path, lastmod }) => {
    const loc = `    <loc>${escapeXml(`${base}${path}`)}</loc>`;
    const modified = lastmod ? `\n    <lastmod>${lastmod.toISOString()}</lastmod>` : '';
    return `  <url>\n${loc}${modified}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
