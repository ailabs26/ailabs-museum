import type { MuseumDisplay } from '@/interfaces/museumScene';

export function ExhibitionDisplay({ display }: { display: MuseumDisplay }) {
  const isCenterpiece = display.shape === 'torus';
  return (
    <group position={display.position}>
      {/* A flat contact patch anchors the plinth without dynamic shadows. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <circleGeometry args={[isCenterpiece ? 1.5 : 0.95, 32]} />
        <meshBasicMaterial color="#6c6251" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[isCenterpiece ? 1.15 : 0.7, isCenterpiece ? 1.2 : 0.74, 1.1, 32]} />
        <meshStandardMaterial color="#ece5d8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[isCenterpiece ? 1.17 : 0.72, isCenterpiece ? 1.17 : 0.72, 0.04, 32]} />
        <meshStandardMaterial color="#9a7b50" metalness={0.4} roughness={0.48} />
      </mesh>
      <mesh position={[0, isCenterpiece ? 2.16 : 1.73, 0]} rotation={[0, 0, display.shape === 'cube' ? 0.12 : 0]}>
        {display.shape === 'torus' && <torusGeometry args={[0.8, 0.2, 16, 48]} />}
        {display.shape === 'sphere' && <sphereGeometry args={[0.57, 24, 16]} />}
        {display.shape === 'cube' && <boxGeometry args={[0.9, 0.9, 0.9]} />}
        {display.shape === 'cone' && <coneGeometry args={[0.52, 1.2, 24]} />}
        {display.shape === 'icosahedron' && <icosahedronGeometry args={[0.64, 0]} />}
        <meshStandardMaterial color={display.color} roughness={isCenterpiece ? 0.32 : 0.6} metalness={isCenterpiece ? 0.65 : 0.12} />
      </mesh>
    </group>
  );
}
