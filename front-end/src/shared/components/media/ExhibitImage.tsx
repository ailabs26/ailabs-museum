import { useState, type ComponentProps } from 'react';
import { ExhibitPreview } from '@/shared/components/data/ExhibitPreview';

/** The validated published image is independent of the WebGL asset pipeline. */
export function ExhibitImage({ image, shape, color, className, loading = 'lazy' }: ComponentProps<typeof ExhibitPreview> & {
  image?: { url: string; alt: string } | null;
  loading?: 'eager' | 'lazy';
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return image && failedUrl !== image.url
    ? <img className={className} src={image.url} alt={image.alt} loading={loading} referrerPolicy="no-referrer"
      style={{ display: 'block', width: '100%', maxWidth: '100%', objectFit: 'contain' }} onError={() => setFailedUrl(image.url)} />
    : <ExhibitPreview shape={shape} color={color} className={className} />;
}
