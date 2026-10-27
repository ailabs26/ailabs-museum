import { useEffect, useState } from 'react';
import { getMuseumQuality } from '@/helpers/museumQuality';

function readQuality() {
  return getMuseumQuality({ cores: navigator.hardwareConcurrency,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    width: Math.min(window.innerWidth, window.innerHeight), isCoarse: matchMedia('(pointer: coarse)').matches });
}

export function useMuseumQuality() {
  const [quality, setQuality] = useState(readQuality);
  useEffect(() => {
    const resize = () => setQuality(previous => {
      const next = readQuality(); return previous.tier === next.tier ? previous : next;
    });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return quality;
}
