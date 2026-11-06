import { Button } from '@mantine/core';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { favoritesStore, isSameExhibit, toggleFavorite } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';

export function FavoriteButton({ target, name, onRemove }: { target: VisitorExhibitRef; name: string; onRemove?: () => void }) {
  const { t } = usePublicLocale();
  const { value } = useVisitorStore(favoritesStore);
  const isFavorite = value.some(ref => isSameExhibit(ref, target));
  const Icon = isFavorite ? IconHeartFilled : IconHeart;
  return <Button variant={isFavorite ? 'light' : 'default'} size="sm" aria-pressed={isFavorite}
    aria-label={t(isFavorite ? 'ui.visitor.favorite.aria-remove' : 'ui.visitor.favorite.aria-add',
      isFavorite ? 'Bỏ yêu thích {name}' : 'Thêm {name} vào yêu thích').replace('{name}', () => name)}
    leftSection={<Icon size={16} aria-hidden="true" />}
    onClick={() => {
      favoritesStore.update(refs => toggleFavorite(refs, target));
      if (isFavorite) onRemove?.();
    }}>
    {isFavorite ? t('ui.visitor.favorite.saved', 'Đã yêu thích') : t('ui.visitor.favorite.add', 'Yêu thích')}
  </Button>;
}
