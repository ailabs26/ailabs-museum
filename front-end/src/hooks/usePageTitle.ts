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
