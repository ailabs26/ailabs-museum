import type { ReactNode } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** nút hành động bên phải (Tạo mới, Lưu...) */
  actions?: ReactNode;
}

/** Tiêu đề trang chuẩn cho các màn hình Admin. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap">
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group>{actions}</Group>}
    </Group>
  );
}
