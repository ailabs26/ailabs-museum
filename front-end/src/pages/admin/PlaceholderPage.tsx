import { Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';

/** Trang giữ chỗ cho các màn hình Admin sẽ dựng ở PR #F và sau đó. */
export function PlaceholderPage({ title, pr }: { title: string; pr?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Alert icon={<IconInfoCircle />} color="aura" variant="light">
        Màn hình "{title}" sẽ được dựng ở {pr ?? 'PR tiếp theo'}. Khung điều hướng, layout và quyền đã sẵn sàng.
      </Alert>
    </>
  );
}
