import { Button } from '@mantine/core';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { favoritesStore, isSameExhibit, toggleFavorite } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';
import { useVisitorStore } from '@/hooks/useVisitorStore';

export function FavoriteButton({ target, name }: { target: VisitorExhibitRef; name: string }) {
  const { value } = useVisitorStore(favoritesStore);
  const isFavorite = value.some(ref => isSameExhibit(ref, target));
  const Icon = isFavorite ? IconHeartFilled : IconHeart;
  return <Button variant={isFavorite ? 'light' : 'default'} size="sm" aria-pressed={isFavorite}
    aria-label={`Yêu thích ${name}`} leftSection={<Icon size={16} aria-hidden="true" />}
    onClick={() => favoritesStore.update(refs => toggleFavorite(refs, target))}>
    {isFavorite ? 'Đã yêu thích' : 'Yêu thích'}
  </Button>;
}
