import { IconCloudUpload } from '@tabler/icons-react';
import { Text } from '@mantine/core';
import { useState, type DragEvent } from 'react';
import classes from './UploadDropzone.module.css';

/**
 * Vùng kéo-thả tệp hiện đại: viền nét đứt chuyển động, đổi màu khi rê tệp vào.
 * Thả tệp -> gọi onFile(file) (dùng chung pipeline với nút chọn tệp).
 */
export function UploadDropzone({ onFile, hint, disabled }: {
  onFile: (file: File) => void; hint?: string; disabled?: boolean;
}) {
  const [over, setOver] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`${classes.zone} ${over ? classes.over : ''} ${disabled ? classes.disabled : ''}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      aria-hidden="true"
    >
      <IconCloudUpload size={30} className={classes.icon} />
      <Text size="sm" fw={600}>Kéo &amp; thả tệp vào đây</Text>
      {hint && <Text size="xs" c="dimmed" ta="center">{hint}</Text>}
    </div>
  );
}
