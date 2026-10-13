import type { MuseumDisplay } from '@/interfaces/museumScene';

export function ExhibitionDisplay({ display }: { display: MuseumDisplay }) {
  const isCenterpiece = display.shape === 'torus';
  const isRoundPlinth = isCenterpiece || display.shape === 'sphere' || display.shape === 'cylinder';
  return (
    <group position={display.position}>
      {/* A flat contact patch anchors the plinth without dynamic shadows. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <circleGeometry args={[isCenterpiece ? 1.5 : 0.95, 32]} />
        <meshBasicMaterial color="#6c6251" transparent opacity={0.16} depthWrite={false} />
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
      <mesh position={[0, isCenterpiece ? 2.16 : 1.73, 0]} rotation={[0, 0, display.shape === 'cube' ? 0.12 : 0]}>
        {display.shape === 'torus' && <torusGeometry args={[0.8, 0.2, 16, 48]} />}
        {display.shape === 'sphere' && <sphereGeometry args={[0.57, 24, 16]} />}
        {display.shape === 'cube' && <boxGeometry args={[0.9, 0.9, 0.9]} />}
        {display.shape === 'cone' && <coneGeometry args={[0.52, 1.2, 24]} />}
        {display.shape === 'cylinder' && <cylinderGeometry args={[0.45, 0.45, 1.1, 24]} />}
        {display.shape === 'icosahedron' && <icosahedronGeometry args={[0.64, 0]} />}
        <meshStandardMaterial color={display.color} roughness={isCenterpiece ? 0.44 : display.shape === 'cylinder' ? 0.55 : 0.7} metalness={isCenterpiece ? 0.48 : 0.06} />
      </mesh>
    </group>
  );
}
