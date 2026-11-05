import type { CSSProperties } from 'react';
import classes from './ExhibitPreview.module.css';

type ExhibitPreviewProps = {
  shape: 'box' | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'icosahedron';
  color: string;
  className?: string;
  labels?: { preview: string; imageMissing: string };
};

export function ExhibitPreview({ shape, color, className, labels = {
  preview: 'Hình minh họa thay thế', imageMissing: 'Chưa có ảnh',
} }: ExhibitPreviewProps) {
  return (
    <div className={`${classes.preview}${className ? ` ${className}` : ''}`}>
      <span className={classes.shape} data-shape={shape === 'cube' ? 'box' : shape}
        aria-hidden="true" style={{ '--exhibit-color': color } as CSSProperties} />
      <div className={classes.caption}>
        <span>{labels.preview}</span>
        <span className={classes.missingImage}>{labels.imageMissing}</span>
      </div>
    </div>
  );
}
