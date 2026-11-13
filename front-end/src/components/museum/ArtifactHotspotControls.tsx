import { Button, Group } from '@mantine/core';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { getArtifactHotspots } from '@/helpers/artifactHotspots';
import { usePublicT } from '@/core/i18n/public-locale';

/** Native equivalents stay accessible even when a depth-tested 3D marker is occluded. */
export function ArtifactHotspotControls({ displays, selectedId, onSelect }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const t = usePublicT();
  return <Group gap="xs" p="xs" role="group" aria-label={t('ui.artifact.hotspots-aria', 'Điểm tương tác hiện vật')}>
    {displays.filter(display => !display.isOutsideRoom).flatMap(display => getArtifactHotspots(display).map(hotspot =>
      <Button key={`${display.id}:${hotspot.id}`} size="xs" variant={display.id === selectedId ? 'filled' : 'light'} color="teal.9"
        aria-label={display.hotspots?.length
          ? t('ui.artifact.hotspot-aria-label', 'Điểm tương tác {name}: {label}', { name: display.title, label: hotspot.label })
          : t('ui.artifact.hotspot-aria', 'Điểm tương tác {name}', { name: display.title })}
        aria-pressed={display.id === selectedId} title={hotspot.body} onClick={() => onSelect(display.id)}>
        {hotspot.label}
      </Button>))}
  </Group>;
}
