import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { PublicLocale } from '@/helpers/publicLocale';
import type { resolveHotspotStory } from '@/helpers/hotspotStory';
import classes from './ExhibitDetailPanel.module.css';

const messages: Record<PublicLocale, Record<'title' | 'progress' | 'previous' | 'next' | 'close' | 'empty', string>> = {
  vi: {
    title: 'Khám phá chi tiết hiện vật', progress: '{current}/{total} điểm khám phá',
    previous: 'Điểm trước', next: 'Điểm tiếp theo', close: 'Thông tin hiện vật', empty: 'Chưa có nội dung cho điểm này.',
  },
  en: {
    title: 'Explore artifact details', progress: '{current}/{total} points of interest',
    previous: 'Previous point', next: 'Next point', close: 'Artifact information', empty: 'No content is available for this point.',
  },
  fr: {
    title: 'Explorer les détails de l’objet', progress: '{current}/{total} points d’intérêt',
    previous: 'Point précédent', next: 'Point suivant', close: 'Informations sur l’objet', empty: 'Aucun contenu pour ce point.',
  },
  zh: {
    title: '探索展品细节', progress: '{current}/{total} 个探索点',
    previous: '上一个探索点', next: '下一个探索点', close: '展品信息', empty: '此探索点暂无内容。',
  },
  ko: {
    title: '전시품 세부 탐색', progress: '탐색 지점 {current}/{total}',
    previous: '이전 지점', next: '다음 지점', close: '전시품 정보', empty: '이 지점에 대한 내용이 없습니다.',
  },
  ja: {
    title: '展示品の詳細を探索', progress: '見どころ {current}/{total}',
    previous: '前の見どころ', next: '次の見どころ', close: '展示品の情報', empty: 'この見どころの解説はありません。',
  },
};

export function HotspotStory({ story, exhibitTitle, onSelect, onClose }: {
  story: NonNullable<ReturnType<typeof resolveHotspotStory>>;
  exhibitTitle: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { locale, t } = usePublicLocale();
  const copy = messages[locale] ?? messages.vi;
  const { hotspot, hotspots, index } = story;
  const label = hotspot.label || exhibitTitle;
  const previous = hotspots[index - 1];
  const next = hotspots[index + 1];
  const progress = t('ui.hotspot-story.progress', copy.progress, { current: index + 1, total: hotspots.length });

  return (
    <section className={classes.story} aria-label={t('ui.hotspot-story.title', copy.title)}>
      <Stack gap="sm">
        <div role="status" aria-live="polite" aria-atomic="true">
          <Text size="sm" c="teal.9">{progress}</Text>
          <Title order={3} size="h4" className={classes.storyHeading}>{label}</Title>
        </div>
        <Text size="sm" className={classes.body}>{hotspot.body.trim() ? hotspot.body : t('ui.hotspot-story.empty', copy.empty)}</Text>
        <Group gap={6} grow wrap="nowrap" className={classes.storyNavigation}>
          <Button variant="default" size="compact-sm" aria-disabled={!previous} onClick={() => previous && onSelect(previous.id)}>
            {t('ui.hotspot-story.previous', copy.previous)}
          </Button>
          <Button variant="light" color="teal.9" size="compact-sm" aria-disabled={!next} onClick={() => next && onSelect(next.id)}>
            {t('ui.hotspot-story.next', copy.next)}
          </Button>
        </Group>
        <Button variant="subtle" color="teal.9" size="compact-sm" className={classes.storyBack} onClick={onClose}>
          {t('ui.hotspot-story.close', copy.close)}
        </Button>
      </Stack>
    </section>
  );
}
