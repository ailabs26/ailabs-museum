import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { ArtifactHotspot as Hotspot } from '@/helpers/artifactHotspots';
import { ArtifactCaption } from './ArtifactCaption';
import type { Translator } from '@/core/i18n/public-locale';

export function ArtifactHotspot({ hotspot, artifactTitle, isSelected, isXrHovered = false, onSelect, translate }: {
  isXrHovered?: boolean;
  hotspot: Hotspot; artifactTitle: string; isSelected: boolean; onSelect: (id: string) => void;
  translate: Translator;
}) {
  const [isPointerHovered, setIsHovered] = useState(false);
  const isHovered = isPointerHovered || isXrHovered;
  const canvas = useThree(state => state.gl.domElement);
  useEffect(() => {
    if (!isHovered) return;
    canvas.style.cursor = 'pointer'; return () => { canvas.style.cursor = ''; };
  }, [canvas, isHovered]);
  return <group position={hotspot.position} userData={{ hotspotId: hotspot.id, artifactId: hotspot.artifactId }}
    onPointerOver={event => { event.stopPropagation(); setIsHovered(true); }} onPointerOut={() => setIsHovered(false)}
    onClick={event => { event.stopPropagation(); if (event.delta <= 5) onSelect(hotspot.artifactId); }}>
    <mesh scale={isHovered ? 1.2 : 1}>
      <sphereGeometry args={[0.12, 12, 8]} /><meshBasicMaterial color={isSelected ? '#25645c' : isHovered ? '#b69761' : '#f7f3ea'} />
    </mesh>
    {isHovered && <ArtifactCaption title={artifactTitle} subtitle={hotspot.label === artifactTitle ? translate('ui.tour.hotspot.select', 'Chọn để khám phá') : hotspot.label} position={[0, 0.4, 0]} />}
  </group>;
}
