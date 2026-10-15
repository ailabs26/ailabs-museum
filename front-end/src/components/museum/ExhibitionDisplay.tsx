import type { MuseumDisplay } from '@/interfaces/museumScene';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { ExhibitLabel } from './ExhibitLabel';
import { ArtifactModel } from './ArtifactModel';
import type { ModelLoadState } from '@/helpers/roomModelAssets';

export function ExhibitionDisplay({ display, isSelected, onSelect, modelState }: {
  display: MuseumDisplay; isSelected: boolean; onSelect: (id: string) => void; modelState?: ModelLoadState;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!isHovered) return;
    canvas.style.cursor = 'pointer';
    return () => { canvas.style.cursor = ''; };
  }, [canvas, isHovered]);
  const isCenterpiece = !!display.model || display.shape === 'torus';
  const isRoundPlinth = isCenterpiece || display.shape === 'sphere' || display.shape === 'cylinder';
  return (
    <group position={display.position} userData={{ artifactId: display.id }}
      onPointerOver={(event) => { event.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onSelect(display.id); }}>
      {/* A flat contact patch anchors the plinth without dynamic shadows. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <circleGeometry args={[isCenterpiece ? 1.3 : 0.84, 32]} />
        <meshBasicMaterial color="#5e584d" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <ringGeometry args={[isCenterpiece ? 1.3 : 0.84, isCenterpiece ? 1.5 : 0.95, 32]} />
        <meshBasicMaterial color={isSelected ? '#25645c' : isHovered ? '#b69761' : '#fff3d6'} transparent opacity={isSelected ? 0.9 : isHovered ? 0.7 : 0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? 1.22 : 0.76, isCenterpiece ? 1.22 : 0.76, 0.08, 32]} /> : <boxGeometry args={[1.15, 0.08, 1.15]} />}
        <meshStandardMaterial color="#736a5b" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? 1.1 : 0.66, isCenterpiece ? 1.16 : 0.7, 1.04, 32]} /> : <boxGeometry args={[1.05, 1.04, 1.05]} />}
        <meshStandardMaterial color="#e7dfd0" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        {isRoundPlinth ? <cylinderGeometry args={[isCenterpiece ? 1.13 : 0.7, isCenterpiece ? 1.13 : 0.7, 0.04, 32]} /> : <boxGeometry args={[1.09, 0.04, 1.09]} />}
        <meshStandardMaterial color="#85745b" metalness={0.28} roughness={0.62} />
      </mesh>
      {display.model ? modelState?.status === 'ready' ? <ArtifactModel asset={modelState.asset} artifactId={display.id} /> :
        <mesh position={[0, 1.5, 0]}>
          <torusGeometry args={[0.16, 0.025, 8, 24]} />
          <meshBasicMaterial color={modelState?.status === 'error' ? '#b23b3b' : '#b69761'} wireframe />
        </mesh> : <mesh position={[0, isCenterpiece ? 2.16 : 1.73, 0]} rotation={[0, 0, display.shape === 'cube' ? 0.12 : 0]}>
        {display.shape === 'torus' && <torusGeometry args={[0.8, 0.2, 16, 48]} />}
        {display.shape === 'sphere' && <sphereGeometry args={[0.57, 24, 16]} />}
        {display.shape === 'cube' && <boxGeometry args={[0.9, 0.9, 0.9]} />}
        {display.shape === 'cone' && <coneGeometry args={[0.52, 1.2, 24]} />}
        {display.shape === 'cylinder' && <cylinderGeometry args={[0.45, 0.45, 1.1, 24]} />}
        {display.shape === 'icosahedron' && <icosahedronGeometry args={[0.64, 0]} />}
        <meshStandardMaterial color={display.color} roughness={isCenterpiece ? 0.44 : display.shape === 'cylinder' ? 0.55 : 0.7} metalness={isCenterpiece ? 0.48 : 0.06}
          emissive={isSelected ? '#25645c' : '#b69761'} emissiveIntensity={isSelected ? 0.15 : isHovered ? 0.12 : 0} />
      </mesh>}
      <ExhibitLabel title={display.title} isSelected={isSelected} isCenterpiece={isCenterpiece} />
    </group>
  );
}
