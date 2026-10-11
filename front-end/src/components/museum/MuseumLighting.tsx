export function MuseumLighting() {
  return (
    <>
      <ambientLight color="#fff3df" intensity={0.35} />
      <hemisphereLight args={['#fff3d6', '#69756f', 1.5]} />
      <directionalLight position={[-3, 4.5, 5]} color="#ffe3b0" intensity={2.5} />
      <directionalLight position={[4, 3, -4]} color="#dcebf0" intensity={1.2} />
      <spotLight position={[0, 4.8, 1]} color="#ffdfaa" intensity={30} angle={0.6} penumbra={0.8} distance={12} />
    </>
  );
}
