import { useState } from 'react';
import { Alert, Badge, Button, FileInput, Group, List, Modal, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconFileImport, IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { errorRows, importFileProblem, importSummary } from '@/helpers/exhibitImport';
import { exhibitsService, type ImportExhibitsResult } from '@/services/exhibits.service';
import { notify } from '@/shared/components/feedback';

export interface ExhibitImportModalProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Task 38 — nhập hiện vật hàng loạt từ CSV/JSON: chọn file → "Kiểm tra" (dry run, không ghi gì) →
 * xem dòng lỗi → "Nhập" các dòng hợp lệ. Mỗi dòng tạo một bản nháp MỚI; dòng lỗi bị bỏ qua và được
 * liệt kê lại sau khi nhập (thành công một phần).
 */
export function ExhibitImportModal({ opened, onClose }: ExhibitImportModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportExhibitsResult | null>(null);
  const [result, setResult] = useState<ImportExhibitsResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const reset = (next: File | null = null) => {
    setFile(next);
    setPreview(null);
    setResult(null);
    setFileError(importFileProblem(next));
  };

  const handleError = (error: Error) => setFileError(error instanceof ApiException ? error.message : 'Không gửi được file, vui lòng thử lại');

  const check = useMutation({
    mutationFn: (selected: File) => exhibitsService.importFile(selected, true),
    onMutate: () => setFileError(null),
    onSuccess: setPreview,
    onError: handleError,
  });

  const run = useMutation({
    mutationFn: (selected: File) => exhibitsService.importFile(selected, false),
    onMutate: () => setFileError(null),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      if (data.created > 0) {
        void queryClient.invalidateQueries({ queryKey: ['admin-exhibits'] });
        notify.success(importSummary(data));
      }
    },
    onError: handleError,
  });

  const close = () => {
    if (check.isPending || run.isPending) return;
    reset();
    onClose();
  };

  const shown = result ?? preview;
  const failures = shown ? errorRows(shown) : [];
  const busy = check.isPending || run.isPending;

  return (
    <Modal opened={opened} onClose={close} title="Nhập hiện vật từ CSV/JSON" size="xl" closeOnClickOutside={!busy}>
      <Stack gap="sm">
        <Alert variant="light" icon={<IconInfoCircle size={16} />}>
          <List size="sm" spacing={2}>
            <List.Item>Mỗi dòng hợp lệ tạo một <b>bản nháp mới</b> (không ghi đè hiện vật cũ, không tự xuất bản).</List.Item>
            <List.Item>Cần cột <Text span ff="monospace">roomSlug</Text> hoặc <Text span ff="monospace">roomId</Text>. Dùng nút <b>Xuất</b> để có file mẫu đúng tên cột.</List.Item>
            <List.Item>Tối đa 500 dòng, 2 MB. CSV lưu dạng UTF-8.</List.Item>
          </List>
        </Alert>

        <FileInput
          label="File nhập"
          placeholder="Chọn file .csv hoặc .json"
          accept=".csv,.json,text/csv,application/json"
          value={file}
          onChange={reset}
          clearable
          disabled={busy}
          leftSection={<IconFileImport size={16} />}
          error={fileError}
        />

        {shown && (
          <Alert
            color={shown.failed === 0 ? 'green' : 'yellow'}
            icon={shown.failed === 0 ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
            title={result ? 'Kết quả nhập' : 'Kết quả kiểm tra'}
          >
            <Group gap="xs" mb={4}>
              <Badge color="gray" variant="light">{shown.total} dòng</Badge>
              <Badge color="green" variant="light">{result ? `${shown.created} đã tạo` : `${shown.valid} hợp lệ`}</Badge>
              {shown.failed > 0 && <Badge color="red" variant="light">{shown.failed} lỗi</Badge>}
            </Group>
            <Text size="sm">{importSummary(shown)}</Text>
          </Alert>
        )}

        {failures.length > 0 && (
          <ScrollArea.Autosize mah={280} type="auto">
            <Table striped withTableBorder fz="sm" aria-label="Các dòng lỗi">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={70}>Dòng</Table.Th>
                  <Table.Th w={180}>Tên (vi)</Table.Th>
                  <Table.Th>Lỗi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {failures.map((row) => (
                  <Table.Tr key={row.row}>
                    <Table.Td>{row.row}</Table.Td>
                    <Table.Td>{row.name ?? <Text span c="dimmed">—</Text>}</Table.Td>
                    <Table.Td>{row.message}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
        {failures.length > 0 && (
          <Text size="xs" c="dimmed">Số dòng đếm từ dòng dữ liệu đầu tiên (không tính dòng tiêu đề CSV).</Text>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={close} disabled={busy}>
            {result ? 'Đóng' : 'Hủy'}
          </Button>
          {!result && (
            <Button variant="light" onClick={() => file && check.mutate(file)} loading={check.isPending}
              disabled={!file || Boolean(fileError) || run.isPending}>
              Kiểm tra
            </Button>
          )}
          {!result && (
            <Button onClick={() => file && run.mutate(file)} loading={run.isPending}
              disabled={!preview || preview.valid === 0 || check.isPending}>
              {preview ? `Nhập ${preview.valid} dòng hợp lệ` : 'Nhập'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
