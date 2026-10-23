import { useState, type ComponentProps } from 'react';
import { ExhibitPreview } from '@/shared/components/data/ExhibitPreview';

/** The validated published image is independent of the WebGL asset pipeline. */
export function ExhibitImage({ image, shape, color, className }: ComponentProps<typeof ExhibitPreview> & {
  image?: { url: string; alt: string } | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return image && failedUrl !== image.url
    ? <img className={className} src={image.url} alt={image.alt} loading="lazy" referrerPolicy="no-referrer"
      style={{ display: 'block', width: '100%', maxWidth: '100%', objectFit: 'contain' }} onError={() => setFailedUrl(image.url)} />
    : <ExhibitPreview shape={shape} color={color} className={className} />;
}
