import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconArrowDown, IconArrowUp, IconCrosshair, IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { emptyHotspot, HOTSPOT_BODY_MAX, HOTSPOT_LABEL_MAX } from '@/helpers/exhibitHotspots';
import type { HotspotFormValue } from '@/helpers/exhibitHotspots';
import { mediaService } from '@/services/media.service';
import type { HotspotPoint } from '@/shared/components/media/ModelHotspotPicker';

const ModelHotspotPicker = lazy(() => import('@/shared/components/media/ModelHotspotPicker'));

type ModelFile = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; url: string };

/**
 * Tải file GLB qua API đã xác thực rồi tạo blob URL (model seed không có URL ký);
 * hủy tải và thu hồi blob URL khi đổi model hoặc rời form.
 */
function useModelFile(mediaId: string | null): ModelFile {
  const [file, setFile] = useState<ModelFile>({ status: 'idle' });
  useEffect(() => {
    if (!mediaId) {
      setFile({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    let url: string | null = null;
    setFile({ status: 'loading' });
    mediaService
      .content(mediaId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setFile({ status: 'ready', url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFile({ status: 'error' });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaId]);
  return file;
}

export interface HotspotEditorProps<T extends { hotspots: HotspotFormValue[] }> {
  form: UseFormReturnType<T>;
  /** Model đang chọn trong form (có thể khác bản đã lưu) — dùng để bấm chọn vị trí. */
  modelId: string | null;
  /** `false` khi đang tải hotspot của bản đã lưu: chặn sửa để không ghi đè bằng danh sách rỗng. */
  ready: boolean;
  loadError?: boolean;
}

/**
 * Thêm/sửa/xóa/sắp xếp hotspot của bản nháp (FR-62–66). Có model thì bấm lên mô hình để lấy tọa
 * độ local của GLB gốc (FR-65); không có model thì tọa độ là mét quanh tâm bệ trưng bày.
 */
export function HotspotEditor<T extends { hotspots: HotspotFormValue[] }>({
  form,
  modelId,
  ready,
  loadError,
}: HotspotEditorProps<T>) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hotspots = form.values.hotspots;

  const modelFile = useModelFile(ready ? modelId : null);
  const modelUrl = modelFile.status === 'ready' ? modelFile.url : null;

  if (loadError) {
    return (
      <Alert color="red" icon={<IconInfoCircle size={18} />}>
        Không tải được hotspot của hiện vật. Các thay đổi khác vẫn lưu được; hotspot hiện có được giữ nguyên.
      </Alert>
    );
  }
  if (!ready) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const add = () => {
    form.insertListItem('hotspots', emptyHotspot());
    setActiveIndex(hotspots.length);
  };
  const remove = (index: number) => {
    form.removeListItem('hotspots', index);
    setActiveIndex(null);
  };
  const move = (from: number, to: number) => {
    form.reorderListItem('hotspots', { from, to });
    setActiveIndex(activeIndex === from ? to : activeIndex);
  };
  const setPosition = (point: HotspotPoint) => {
    if (activeIndex === null) return;
    form.setFieldValue(`hotspots.${activeIndex}.positionX`, point[0] as never);
    form.setFieldValue(`hotspots.${activeIndex}.positionY`, point[1] as never);
    form.setFieldValue(`hotspots.${activeIndex}.positionZ`, point[2] as never);
  };

  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
        <Text size="sm">
          Hotspot là điểm tương tác trên hiện vật, cần tiêu đề và nội dung cả hai ngôn ngữ. Bộ nghiệm thu yêu cầu mỗi
          hiện vật có ít nhất một hotspot. Tọa độ tính theo <strong>hệ local của file GLB gốc</strong> (mét, Y hướng
          lên); hiện vật chưa có model thì tính quanh tâm bệ trưng bày.
        </Text>
      </Alert>

      {modelId && (
        <Card withBorder p="sm" radius="xs">
          <Text fw={600} size="sm" mb="xs">
            Đặt vị trí trên mô hình
          </Text>
          {modelUrl ? (
            <Suspense fallback={<Center h={320}><Loader size="sm" /></Center>}>
              <ModelHotspotPicker
                url={modelUrl}
                points={hotspots.map((h) => [h.positionX, h.positionY, h.positionZ])}
                activeIndex={activeIndex}
                onPick={setPosition}
              />
            </Suspense>
          ) : (
            <Text size="sm" c="dimmed">
              {modelFile.status === 'error'
                ? 'Không tải được model đang chọn — nhập tọa độ bằng tay.'
                : 'Đang tải mô hình…'}
            </Text>
          )}
        </Card>
      )}

      {hotspots.length === 0 && (
        <Text size="sm" c="dimmed" ta="center">
          Chưa có hotspot nào.
        </Text>
      )}

      {hotspots.map((_, index) => (
        <Card
          key={index}
          withBorder
          p="sm"
          radius="xs"
          style={index === activeIndex ? { borderColor: 'var(--mantine-color-red-5)' } : undefined}
        >
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm">
              Hotspot #{index + 1}
            </Text>
            <Group gap={4}>
              {modelUrl && (
                <Button
                  size="compact-xs"
                  variant={index === activeIndex ? 'filled' : 'light'}
                  color="red"
                  leftSection={<IconCrosshair size={14} />}
                  onClick={() => setActiveIndex(index === activeIndex ? null : index)}
                >
                  {index === activeIndex ? 'Đang chọn trên mô hình' : 'Chọn trên mô hình'}
                </Button>
              )}
              <Tooltip label="Lên trên">
                <ActionIcon variant="subtle" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Đưa hotspot #${index + 1} lên trên`}>
                  <IconArrowUp size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Xuống dưới">
                <ActionIcon
                  variant="subtle"
                  disabled={index === hotspots.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Đưa hotspot #${index + 1} xuống dưới`}
                >
                  <IconArrowDown size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Xóa hotspot">
                <ActionIcon variant="subtle" color="red" onClick={() => remove(index)} aria-label={`Xóa hotspot #${index + 1}`}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Grid gutter="xs">
            <Grid.Col span={6}>
              <TextInput
                label="Tiêu đề (Tiếng Việt)"
                required
                maxLength={HOTSPOT_LABEL_MAX}
                {...form.getInputProps(`hotspots.${index}.labelVi`)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Tiêu đề (Tiếng Anh)"
                required
                maxLength={HOTSPOT_LABEL_MAX}
                {...form.getInputProps(`hotspots.${index}.labelEn`)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                label="Nội dung (Tiếng Việt)"
                required
                autosize
                minRows={2}
                maxRows={6}
                maxLength={HOTSPOT_BODY_MAX}
                {...form.getInputProps(`hotspots.${index}.bodyVi`)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Textarea
                label="Nội dung (Tiếng Anh)"
                required
                autosize
                minRows={2}
                maxRows={6}
                maxLength={HOTSPOT_BODY_MAX}
                {...form.getInputProps(`hotspots.${index}.bodyEn`)}
              />
            </Grid.Col>
            {(['X', 'Y', 'Z'] as const).map((axis) => (
              <Grid.Col span={4} key={axis}>
                <NumberInput
                  label={`Vị trí ${axis}`}
                  step={0.05}
                  decimalScale={3}
                  {...form.getInputProps(`hotspots.${index}.position${axis}`)}
                />
              </Grid.Col>
            ))}
          </Grid>
        </Card>
      ))}

      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={add} style={{ alignSelf: 'flex-start' }}>
        Thêm hotspot
      </Button>
    </Stack>
  );
}
