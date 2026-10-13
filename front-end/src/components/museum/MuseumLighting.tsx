export function MuseumLighting() {
  return (
    <>
      <ambientLight color="#fff7ec" intensity={0.65} />
      <hemisphereLight args={['#fff6e8', '#aaa493', 1.3]} />
      <directionalLight position={[-3, 4.5, 5]} color="#ffebce" intensity={2.1} />
      <directionalLight position={[4, 3, -4]} color="#e8eef0" intensity={1.25} />
      {/* One broad accent; no per-exhibit dynamic lights or shadow maps. */}
      <spotLight position={[0, 4.7, 1.5]} color="#ffe9c5" intensity={22} angle={0.7} penumbra={1} distance={13} decay={2} />
    </>
  );
}
