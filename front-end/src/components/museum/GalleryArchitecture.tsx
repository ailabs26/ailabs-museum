/** Inset panels and coffers add depth using geometry, without texture downloads. */
export function GalleryArchitecture() {
  return (
    <group>
      <mesh position={[0, 5.12, 0]}>
        <boxGeometry args={[14.4, 0.24, 16.4]} />
        <meshStandardMaterial color="#eee8dc" roughness={0.95} />
      </mesh>
      {[-4, 0, 4].map((x) => (
        <group key={x} position={[x, 4.94, 0]}>
          <mesh>
            <boxGeometry args={[0.14, 0.12, 15.8]} />
            <meshStandardMaterial color="#524f46" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.075, 14.5]} />
            <meshStandardMaterial color="#fff3dd" emissive="#fff3dd" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
      {[-6.92, 6.92].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.16, 0]}>
            <boxGeometry args={[0.1, 0.32, 16]} />
            <meshStandardMaterial color="#766955" roughness={0.75} metalness={0.1} />
          </mesh>
          {[-6, -2, 2, 6].map((z) => (
            <mesh key={z} position={[x, 2.65, z]}>
              <boxGeometry args={[0.12, 4.7, 0.18]} />
              <meshStandardMaterial color="#d8cfbe" roughness={0.92} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => [-4, 0, 4].map((z) => (
        <group key={`${side}-${z}`} position={[side * 6.9, 2.45, z]}>
          <mesh><boxGeometry args={[0.09, 3.4, 2.9]} /><meshStandardMaterial color="#d4cbb9" roughness={0.95} /></mesh>
          <mesh position={[-side * 0.05, 0, 0]}><boxGeometry args={[0.04, 3.15, 2.65]} /><meshStandardMaterial color="#e6dfd1" roughness={0.92} /></mesh>
          <mesh position={[-side * 0.08, 1.58, 0]}><boxGeometry args={[0.04, 0.025, 2.6]} /><meshBasicMaterial color="#f6e5c8" /></mesh>
        </group>
      )))}
      {[-6, -2, 2, 6].map((z) => (
        <mesh key={`coffer-${z}`} position={[0, 4.88, z]}>
          <boxGeometry args={[13.6, 0.22, 0.22]} /><meshStandardMaterial color="#d6cdbd" roughness={0.95} />
        </mesh>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
        <mesh key={x} position={[x, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.012, 16]} />
          <meshStandardMaterial color="#bfb5a2" roughness={0.9} />
        </mesh>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((z) => (
        <mesh key={z} position={[0, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.012]} />
          <meshStandardMaterial color="#bfb5a2" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, -7.97]}>
        <boxGeometry args={[4.4, 2.8, 0.05]} />
        <meshStandardMaterial color="#3e5a55" roughness={1} />
      </mesh>
      <mesh position={[0, 2.5, -7.91]}>
        <torusGeometry args={[0.9, 0.025, 8, 48]} />
        <meshStandardMaterial color="#cba871" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}
