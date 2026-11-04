import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { Button, MantineProvider, Stack, Text } from '@mantine/core';
import { theme } from '@/app/theme';
import { PublicLocaleProvider } from '@/contexts/PublicLocaleContext';
import { usePublicLocale } from '@/hooks/usePublicLocale';

function LocaleConsumer({ name }: { name: string }) {
  const { locale } = usePublicLocale();
  return <Text data-testid={`locale-${name}`}>{locale}</Text>;
}

function LocaleControls() {
  const { setLocale, storageError } = usePublicLocale();
  return (
    <Stack>
      <Button onClick={() => setLocale('en')}>Set locale to English</Button>
      <Button onClick={() => setLocale('vi')}>Set locale to Vietnamese</Button>
      <Text data-testid="storage-error">{storageError ?? 'none'}</Text>
    </Stack>
  );
}

function PublicLocaleFixture() {
  return (
    <MantineProvider theme={theme}>
      <PublicLocaleProvider>
        <Stack p="md">
          <LocaleConsumer name="first" />
          <LocaleConsumer name="second" />
          <LocaleControls />
        </Stack>
      </PublicLocaleProvider>
    </MantineProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><PublicLocaleFixture /></StrictMode>);
