import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, MantineProvider, Stack } from '@mantine/core';
import { theme } from '@/app/theme';
import { AudioPlayer } from '@/shared/components/media/AudioPlayer';

const AUDIO_SRC = '/audio-fixture.wav';
const SECOND_AUDIO_SRC = '/audio-fixture-2.wav';
const ERROR_SRC = '/audio-error.wav';

function AudioPlayerFixture() {
  const [src, setSrc] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  const [showSecond, setShowSecond] = useState(false);
  const [useLongLabel, setUseLongLabel] = useState(false);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Stack p="md" maw={520}>
        <Stack gap="xs" aria-label="Fixture controls">
          <Button data-testid="load-source" onClick={() => setSrc(AUDIO_SRC)}>Nạp nguồn audio</Button>
          <Button data-testid="load-second-source" variant="default" onClick={() => setSrc(SECOND_AUDIO_SRC)}>Đổi nguồn audio</Button>
          <Button data-testid="load-error-source" variant="default" onClick={() => setSrc(ERROR_SRC)}>Nạp nguồn lỗi</Button>
          <Button data-testid="clear-source" variant="default" onClick={() => setSrc(null)}>Xóa nguồn audio</Button>
          <Button data-testid="unmount-player" variant="default" onClick={() => setIsMounted(false)}>Tháo audio player</Button>
          <Button data-testid="show-second-player" variant="default" onClick={() => setShowSecond(true)}>Thêm player thứ hai</Button>
          <Button data-testid="long-label" variant="default" onClick={() => setUseLongLabel(true)}>Dùng nhãn dài</Button>
        </Stack>
        {isMounted && <AudioPlayer src={src} label={useLongLabel ? 'Bản thuyết minh audio của hiện vật trong phòng trưng bày Aura Museum' : 'Bản thuyết minh mẫu'} />}
        {showSecond && <AudioPlayer src={src} label="Audio player thứ hai" />}
      </Stack>
    </MantineProvider>
  );
}

createRoot(document.getElementById('root')!).render(<AudioPlayerFixture />);
