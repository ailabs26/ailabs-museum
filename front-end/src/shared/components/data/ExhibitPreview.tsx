import type { CSSProperties } from 'react';
import { usePublicT } from '@/core/i18n/public-locale';
import classes from './ExhibitPreview.module.css';

type ExhibitPreviewProps = {
  shape: 'box' | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron';
  color: string;
  className?: string;
};

export function ExhibitPreview({ shape, color, className }: ExhibitPreviewProps) {
  const t = usePublicT();
  return (
    <div className={`${classes.preview}${className ? ` ${className}` : ''}`}>
      <span className={classes.shape} data-shape={shape === 'cube' ? 'box' : shape}
        aria-hidden="true" style={{ '--exhibit-color': color } as CSSProperties} />
      <div className={classes.caption}>
        <span>{t('ui.preview.placeholder', 'Hình minh họa thay thế')}</span>
        <span className={classes.missingImage}>{t('ui.preview.no-image', 'Chưa có ảnh')}</span>
      </div>
    </div>
  );
}
