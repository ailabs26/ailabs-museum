import { Button, Group } from '@mantine/core';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { getArtifactHotspots } from '@/helpers/artifactHotspots';
import { usePublicT } from '@/core/i18n/public-locale';
import type { SelectHotspot } from '@/helpers/hotspotStory';

/** Native equivalents stay accessible even when a depth-tested 3D marker is occluded. */
export function ArtifactHotspotControls({ displays, selectedId, activeHotspotId, onSelect, onSelectHotspot }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
  activeHotspotId?: string; onSelectHotspot?: SelectHotspot;
}) {
  const t = usePublicT();
  return <Group gap="xs" p="xs" role="group" aria-label={t('ui.artifact.hotspots-aria', 'Điểm tương tác hiện vật')}>
    {displays.filter(display => !display.isOutsideRoom).flatMap(display => getArtifactHotspots(display).map(hotspot => {
      const selectsStory = !hotspot.isDefault && !!onSelectHotspot;
      const pressed = display.id === selectedId && (!selectsStory || hotspot.id === activeHotspotId);
      return <Button key={`${display.id}:${hotspot.id}`} size="xs" variant={pressed ? 'filled' : 'light'} color="teal.9"
        aria-label={!hotspot.isDefault
          ? t('ui.artifact.hotspot-aria-label', 'Điểm tương tác {name}: {label}', { name: display.title, label: hotspot.label })
          : t('ui.artifact.hotspot-aria', 'Điểm tương tác {name}', { name: display.title })}
        aria-pressed={pressed} data-hotspot-control={selectsStory || undefined}
        onClick={event => {
          if (selectsStory) onSelectHotspot(display.id, hotspot.id, event.currentTarget);
          else onSelect(display.id);
        }}>
        {hotspot.label}
      </Button>;
    }))}
  </Group>;
}
