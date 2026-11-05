import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import { Button, MantineProvider, Stack, Text } from '@mantine/core';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '@/app/theme';
import { PublicLocaleProvider } from '@/contexts/PublicLocaleContext';
import { usePublicLocale } from '@/hooks/usePublicLocale';
import { PublicLayout } from '@/layouts/PublicLayout';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

function LayoutLocaleRoute({ name, next }: { name: string; next: string }) {
  const { locale, setLocale } = usePublicLocale();
  return (
    <Stack p="md">
      <Text data-testid={`layout-locale-${name}`}>{locale}</Text>
      <Button onClick={() => setLocale('en')}>Set layout locale to English</Button>
      <Link to={next}>Go to {next} layout route</Link>
    </Stack>
  );
}

function PublicLayoutFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/first']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/first" element={<LayoutLocaleRoute name="first" next="/second" />} />
            <Route path="/second" element={<LayoutLocaleRoute name="second" next="/first" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      {new URLSearchParams(location.search).has('layout') ? <PublicLayoutFixture /> : <PublicLocaleFixture />}
    </MantineProvider>
  </StrictMode>,
);
