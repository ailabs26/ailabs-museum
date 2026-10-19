import { Button, Group } from '@mantine/core';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { getArtifactHotspots } from '@/helpers/artifactHotspots';

/** Native equivalents stay accessible even when a depth-tested 3D marker is occluded. */
export function ArtifactHotspotControls({ displays, selectedId, onSelect }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return <Group gap="xs" p="xs" role="group" aria-label="Điểm tương tác hiện vật">
    {displays.filter(display => !display.isOutsideRoom).flatMap(display => getArtifactHotspots(display).map(hotspot =>
      <Button key={`${display.id}:${hotspot.id}`} size="xs" variant={display.id === selectedId ? 'filled' : 'light'} color="teal.9"
        aria-label={`Điểm tương tác ${display.title}${display.hotspots?.length ? `: ${hotspot.label}` : ''}`}
        aria-pressed={display.id === selectedId} title={hotspot.body} onClick={() => onSelect(display.id)}>
        {hotspot.label}
      </Button>))}
  </Group>;
}
