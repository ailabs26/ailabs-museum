/** Low-poly architectural details; emissive panels need no shadow maps. */
export function GalleryArchitecture() {
  return (
    <group>
      <mesh position={[0, 5.12, 0]}>
        <boxGeometry args={[14.4, 0.24, 16.4]} />
        <meshStandardMaterial color="#ebe5d9" roughness={0.95} />
      </mesh>
      {[-4, 0, 4].map((x) => (
        <group key={x} position={[x, 4.94, 0]}>
          <mesh>
            <boxGeometry args={[0.14, 0.12, 15.8]} />
            <meshStandardMaterial color="#605949" />
          </mesh>
          <mesh position={[0, -0.065, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.075, 14.5]} />
            <meshStandardMaterial color="#fff0cb" emissive="#fff0cb" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
      {[-6.92, 6.92].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.16, 0]}>
            <boxGeometry args={[0.1, 0.32, 16]} />
            <meshStandardMaterial color="#9f8967" roughness={0.6} />
          </mesh>
          {[-6, -2, 2, 6].map((z) => (
            <mesh key={z} position={[x, 2.65, z]}>
              <boxGeometry args={[0.12, 4.7, 0.18]} />
              <meshStandardMaterial color="#d2c7b2" />
            </mesh>
          ))}
        </group>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
        <mesh key={x} position={[x, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.012, 16]} />
          <meshStandardMaterial color="#aa9e87" />
        </mesh>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((z) => (
        <mesh key={z} position={[0, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.012]} />
          <meshStandardMaterial color="#aa9e87" />
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
