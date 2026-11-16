import { useState, type ComponentProps } from 'react';
import { ExhibitPreview } from '@/shared/components/data/ExhibitPreview';

/** The validated published image is independent of the WebGL asset pipeline. */
export function ExhibitImage({ image, shape, color, className, loading = 'lazy', fetchPriority, onLoad, onError }: ComponentProps<typeof ExhibitPreview> & {
  image?: { url: string; alt: string } | null;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return image && failedUrl !== image.url
    ? <img className={className} src={image.url} alt={image.alt} loading={loading} referrerPolicy="no-referrer"
      fetchPriority={fetchPriority} style={{ display: 'block', width: '100%', maxWidth: '100%', objectFit: 'contain' }}
      onLoad={onLoad} onError={() => { setFailedUrl(image.url); onError?.(); }} />
    : <ExhibitPreview shape={shape} color={color} className={className} />;
}
