import { lazy, Suspense, useEffect, useState } from 'react';
import { Center, Code, Image, Loader, ScrollArea, Stack, Text } from '@mantine/core';
import type { MediaKind } from '@/helpers/mediaLibrary';

// three.js chỉ tải khi thật sự xem GLB — không làm nặng bundle trang admin.
const ModelPreview = lazy(() => import('./ModelPreview'));

export interface MediaPreviewProps {
  kind: MediaKind;
  /** URL đã ký do API trả; `null` khi media đã xóa / không sẵn sàng. */
  url: string | null;
  altText?: string | null;
  /** Phụ đề WebVTT phát kèm audio (URL đã ký). */
  subtitleUrl?: string | null;
  subtitleLang?: 'vi' | 'en';
  height?: number;
}

function SubtitleText({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setText(null);
    setFailed(false);
    fetch(url, { signal: controller.signal, credentials: 'omit' })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then(setText)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [url]);

  if (failed) return <Text size="sm" c="red">Không đọc được phụ đề.</Text>;
  if (text === null) return <Loader size="xs" />;
  return (
    <ScrollArea h={180} type="auto">
      <Code block fz="xs">{text}</Code>
    </ScrollArea>
  );
}

/** Xem trước một media trong CMS theo loại: ảnh, audio (kèm phụ đề), nội dung phụ đề, GLB 3D. */
export function MediaPreview({ kind, url, altText, subtitleUrl, subtitleLang = 'vi', height = 240 }: MediaPreviewProps) {
  if (!url) {
    return (
      <Center h={80} bg="gray.1" style={{ borderRadius: 4 }}>
        <Text size="sm" c="dimmed">Không xem được: media đã xóa, bị cách ly hoặc chưa sẵn sàng.</Text>
      </Center>
    );
  }

  switch (kind) {
    case 'image':
      return (
        <Image
          src={url}
          alt={altText || 'Ảnh hiện vật (chưa có mô tả thay thế)'}
          mah={height}
          fit="contain"
          radius="sm"
          bg="gray.1"
        />
      );
    case 'audio':
      return (
        <Stack gap={4}>
          <audio controls preload="metadata" crossOrigin="anonymous" src={url} style={{ width: '100%' }}>
            {subtitleUrl && <track kind="subtitles" src={subtitleUrl} srcLang={subtitleLang} label={subtitleLang === 'vi' ? 'Tiếng Việt' : 'English'} default />}
          </audio>
          {subtitleUrl && <Text size="xs" c="dimmed">Phụ đề bật sẵn — dùng nút CC của trình phát để tắt/bật.</Text>}
        </Stack>
      );
    case 'subtitle':
      return <SubtitleText url={url} />;
    case 'model':
      return (
        <Suspense fallback={<Center h={height}><Loader size="sm" /></Center>}>
          <ModelPreview url={url} height={height} />
        </Suspense>
      );
  }
}
