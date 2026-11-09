import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import { Button, MantineProvider, Stack, Text } from '@mantine/core';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/app/theme';
import { queryClient } from '@/core/api/query-client';
import { PublicLocaleProvider } from '@/contexts/PublicLocaleContext';
import { usePublicLocale } from '@/hooks/usePublicLocale';
import { PublicLayout } from '@/layouts/PublicLayout';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { roomDetailSchema } from '@/validations/roomSchema';
import { roomA } from './museumContent';

const guidedTourRoom = roomDetailSchema.parse(roomA);

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
    <MemoryRouter initialEntries={['/first']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/first" element={<LayoutLocaleRoute name="first" next="/second" />} />
          <Route path="/second" element={<LayoutLocaleRoute name="second" next="/first" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function GuidedTourRoute({ next }: { next: string }) {
  const tour = useGuidedTour();
  return (
    <Stack p="md">
      <Text data-testid="guided-status">{tour.status}</Text>
      <Text data-testid="guided-current">{tour.currentStep?.exhibitId ?? 'none'}</Text>
      <Text data-testid="guided-index">{tour.total ? `${tour.currentIndex}/${tour.total}` : '0/0'}</Text>
      <Button onClick={() => tour.start(guidedTourRoom)}>Start tour</Button>
      <Button onClick={tour.next}>Next step</Button>
      <Button onClick={tour.pause}>Pause tour</Button>
      <Button onClick={tour.resume}>Resume tour</Button>
      <Button onClick={tour.exit}>Exit tour</Button>
      <Link to={next}>{next === '/second' ? 'Go to second public route' : 'Go to admin fixture'}</Link>
    </Stack>
  );
}

function PublicGuidedTourFixture() {
  return (
    <MemoryRouter initialEntries={['/first']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/first" element={<GuidedTourRoute next="/second" />} />
          <Route path="/second" element={<GuidedTourRoute next="/admin" />} />
        </Route>
        <Route path="/admin" element={<Stack p="md"><Text data-testid="admin-fixture">Admin fixture</Text><Link to="/first">Return to public route</Link></Stack>} />
      </Routes>
    </MemoryRouter>
  );
}

function GuidedTourOutsideProviderFixture() {
  useGuidedTour();
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        {new URLSearchParams(location.search).has('guided-tour')
          ? <PublicGuidedTourFixture />
          : new URLSearchParams(location.search).has('guided-tour-outside') ? <GuidedTourOutsideProviderFixture />
          : new URLSearchParams(location.search).has('layout') ? <PublicLayoutFixture /> : <PublicLocaleFixture />}
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>,
);
