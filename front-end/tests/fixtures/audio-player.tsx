import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, MantineProvider, Stack } from '@mantine/core';
import { theme } from '@/app/theme';
import { AudioPlayer } from '@/shared/components/media/AudioPlayer';

const AUDIO_SRC = '/audio-fixture.wav';

function AudioPlayerFixture() {
  const [src, setSrc] = useState<string | null>(null);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Stack p="md" maw={520}>
        <Stack gap="xs" aria-label="Fixture controls">
          <Button data-testid="load-source" onClick={() => setSrc(AUDIO_SRC)}>Nạp nguồn audio</Button>
          <Button data-testid="clear-source" variant="default" onClick={() => setSrc(null)}>Xóa nguồn audio</Button>
        </Stack>
        <AudioPlayer src={src} label="Bản thuyết minh mẫu" />
      </Stack>
    </MantineProvider>
  );
}

createRoot(document.getElementById('root')!).render(<AudioPlayerFixture />);
