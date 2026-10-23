import type { ReactNode } from 'react';
import { Group, Paper, Text, ThemeIcon } from '@mantine/core';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  color?: string;
}

/** Thẻ số liệu cho Dashboard (phòng, hiện vật, báo cáo, chờ duyệt...). */
export function StatCard({ label, value, subtitle, icon, color = 'blue' }: StatCardProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {label}
          </Text>
          <Text fw={700} fz={28} lh={1.1} mt={4}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed" mt={6}>
              {subtitle}
            </Text>
          )}
        </div>
        {icon && (
          <ThemeIcon color={color} variant="light" size={44} radius="md">
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}
