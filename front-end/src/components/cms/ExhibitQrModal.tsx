import { useEffect, useState } from 'react';
import { Alert, Button, Center, CopyButton, Group, Image, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconCopy, IconDownload } from '@tabler/icons-react';
import { exhibitQrPng, exhibitQrSvg, exhibitShortUrl, qrFileName, svgDataUrl } from '@/helpers/exhibitQr';
import { saveBlob } from '@/helpers/saveBlob';
import { notify } from '@/shared/components/feedback';

export interface ExhibitQrTarget {
  id: string;
  name: string;
  /** Đã xuất bản và đang hiển thị: khách quét mã mở được ngay. */
  isPublic: boolean;
}

/** Mã QR của một hiện vật: xem, sao chép liên kết, tải PNG/SVG để in. */
export function ExhibitQrModal({ target, onClose }: { target: ExhibitQrTarget | null; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const url = target ? exhibitShortUrl(target.id) : '';

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setSvg(null); setError(false);
    exhibitQrSvg(url).then((value) => { if (!cancelled) setSvg(value); }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [target, url]);

  const download = async (format: 'png' | 'svg') => {
    if (!target) return;
    try {
      const blob = format === 'svg'
        ? new Blob([svg ?? await exhibitQrSvg(url)], { type: 'image/svg+xml' })
        : await (await fetch(await exhibitQrPng(url))).blob();
      saveBlob(blob, qrFileName(target.name, target.id, format));
    } catch {
      notify.error('Không tạo được tệp mã QR');
    }
  };

  return (
    <Modal opened={!!target} onClose={onClose} title={target ? `Mã QR — ${target.name || 'Hiện vật chưa đặt tên'}` : ''} centered>
      {target && (
        <Stack>
          {!target.isPublic && (
            <Alert color="yellow">Hiện vật chưa xuất bản hoặc đang ẩn: khách quét mã sẽ thấy "Không tìm thấy hiện vật" cho tới khi hiện vật được công khai.</Alert>
          )}
          <Center mih={240}>
            {svg ? <Image src={svgDataUrl(svg)} alt={`Mã QR mở trang hiện vật ${target.name}`} w={240} h={240} />
              : error ? <Text c="red" role="alert">Không tạo được mã QR.</Text> : <Loader />}
          </Center>
          <Text size="xs" c="dimmed">Liên kết cố định: đổi slug phòng hay chuyển hiện vật sang phòng khác thì mã đã in vẫn dùng được.</Text>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput label="Liên kết" value={url} readOnly style={{ flex: 1 }} />
            <CopyButton value={url}>
              {({ copied, copy }) => (
                <Button variant="default" leftSection={<IconCopy size={16} />} onClick={copy}>{copied ? 'Đã chép' : 'Sao chép'}</Button>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button variant="default" leftSection={<IconDownload size={16} />} disabled={!svg} onClick={() => void download('svg')}>Tải SVG</Button>
            <Button leftSection={<IconDownload size={16} />} disabled={!svg} onClick={() => void download('png')}>Tải PNG</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
