import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';

export function NotFoundPage() {
  const { t } = usePublicLocale();
  return (
    <Center mih="100vh" p="md">
      <Stack align="center" gap="xs">
        <Title order={1}>404</Title>
        <Text c="dimmed">{t('ui.not-found.message', 'Không tìm thấy trang bạn yêu cầu.')}</Text>
        <Button component={Link} to="/" variant="light">
          {t('ui.not-found.home', 'Về trang chủ')}
        </Button>
      </Stack>
    </Center>
  );
}
