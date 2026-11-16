import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSitemapXml, SITEMAP_MAX_URLS } from '../utils/sitemap-xml';

describe('buildSitemapXml', () => {
  it('URL tuyệt đối theo địa chỉ trang khách, bỏ / cuối; có lastmod khi biết', () => {
    const xml = buildSitemapXml('https://museum.example.com/', [
      { path: '/' },
      { path: '/collection/gom/exhibits/1', lastmod: new Date('2026-11-01T08:00:00Z') },
    ]);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(xml.includes('<loc>https://museum.example.com/</loc>\n  </url>'));
    assert.ok(xml.includes('<loc>https://museum.example.com/collection/gom/exhibits/1</loc>\n    <lastmod>2026-11-01T08:00:00.000Z</lastmod>'));
    assert.ok(xml.trimEnd().endsWith('</urlset>'));
  });

  it('thoát ký tự đặc biệt của XML trong URL', () => {
    const xml = buildSitemapXml('https://museum.example.com', [{ path: "/collection?room=a&b<c>'\"" }]);
    assert.ok(xml.includes('<loc>https://museum.example.com/collection?room=a&amp;b&lt;c&gt;&apos;&quot;</loc>'));
  });

  it('không vượt giới hạn 50.000 URL của một sitemap', () => {
    const entries = Array.from({ length: SITEMAP_MAX_URLS + 5 }, (_, index) => ({ path: `/p/${index}` }));
    assert.equal(buildSitemapXml('https://x.test', entries).match(/<url>/g)?.length, SITEMAP_MAX_URLS);
  });
});
