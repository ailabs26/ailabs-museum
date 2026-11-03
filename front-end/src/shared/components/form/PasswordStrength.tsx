import { List, Progress, Stack, Text } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { passwordRules, passwordScore, type PasswordContext } from '@/helpers/passwordPolicy';

/** Thanh độ mạnh + danh sách quy tắc đạt/chưa đạt, hiện dưới ô nhập mật khẩu mới. */
export function PasswordStrength({ value, context }: { value: string; context?: PasswordContext }) {
  if (!value) return null;
  const score = passwordScore(value, context);
  const color = score < 40 ? 'red' : score < 70 ? 'yellow' : 'teal';
  const label = score < 40 ? 'Yếu' : score < 70 ? 'Trung bình' : 'Mạnh';
  return (
    <Stack gap={6} aria-live="polite">
      <Progress value={score} color={color} size="sm" aria-label={`Độ mạnh mật khẩu: ${label}`} />
      <Text size="xs" c={color}>Độ mạnh: {label}</Text>
      <List size="xs" spacing={2}>
        {passwordRules(value, context).map((rule) => (
          <List.Item key={rule.id}
            icon={rule.ok ? <IconCheck size={14} color="var(--mantine-color-teal-6)" /> : <IconX size={14} color="var(--mantine-color-red-6)" />}>
            <Text size="xs" c={rule.ok ? 'dimmed' : undefined}>{rule.label}</Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
