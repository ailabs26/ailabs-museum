import { useEffect } from 'react';
import { usePublicT } from '@/core/i18n/public-locale';

/** Tiêu đề tab theo trang và ngôn ngữ; `null` là trang chủ. Rời trang thì trả lại tiêu đề trước đó. */
export function usePageTitle(page: string | null): void {
  const t = usePublicT();
  const title = page
    ? t('ui.meta.title', '{page} — Aura Museum', { page })
    : t('ui.meta.home-title', 'Aura Museum — Nghệ thuật và di sản');
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}

/** Tạo hoặc cập nhật một thẻ meta theo selector; trả hàm khôi phục giá trị cũ. */
function upsertMeta(selector: string, create: () => HTMLMetaElement, value: string): () => void {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !meta;
  if (!meta) { meta = create(); document.head.appendChild(meta); }
  const previous = meta.content;
  meta.content = value;
  return () => {
    if (created) meta?.remove();
    else if (meta) meta.content = previous;
  };
}

/**
 * Cập nhật thẻ OpenGraph/Twitter theo từng trang để chia sẻ liên kết (Facebook, Zalo, X…)
 * hiển thị đúng tiêu đề/mô tả/URL. Scraper không chạy JS vẫn có bản tĩnh trong index.html.
 */
export function useSocialMeta(title: string, description: string): void {
  useEffect(() => {
    const url = window.location.href;
    const restores = [
      upsertMeta('meta[property="og:title"]', () => withProperty('og:title'), title),
      upsertMeta('meta[name="twitter:title"]', () => withName('twitter:title'), title),
      upsertMeta('meta[property="og:description"]', () => withProperty('og:description'), description),
      upsertMeta('meta[name="twitter:description"]', () => withName('twitter:description'), description),
      upsertMeta('meta[property="og:url"]', () => withProperty('og:url'), url),
    ];
    return () => { for (const restore of restores) restore(); };
  }, [title, description]);
}

function withProperty(property: string): HTMLMetaElement {
  const meta = document.createElement('meta');
  meta.setAttribute('property', property);
  return meta;
}

function withName(name: string): HTMLMetaElement {
  const meta = document.createElement('meta');
  meta.setAttribute('name', name);
  return meta;
}

/** Mô tả trang cho công cụ tìm kiếm và chia sẻ liên kết, theo ngôn ngữ. */
export function usePageDescription(): void {
  const t = usePublicT();
  const description = t('ui.meta.description', 'Khám phá nghệ thuật và di sản cùng Aura Museum. Mỗi hiện vật mở ra một câu chuyện trong không gian bảo tàng số.');
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = description;
    return () => { meta.content = previous; };
  }, [description]);
}
