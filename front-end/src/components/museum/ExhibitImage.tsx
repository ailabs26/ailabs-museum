import { useState } from 'react';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { ExhibitPreview } from '@/shared/components/data/ExhibitPreview';

/** The validated published image is independent of the WebGL asset pipeline. */
export function ExhibitImage({ display, className }: { display: MuseumDisplay; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return display.image && failedUrl !== display.image.url
    ? <img className={className} src={display.image.url} alt={display.image.alt} loading="lazy" referrerPolicy="no-referrer"
      style={{ display: 'block', width: '100%', height: 200, objectFit: 'contain' }} onError={() => setFailedUrl(display.image!.url)} />
    : <ExhibitPreview shape={display.shape} color={display.color} className={className} />;
}
