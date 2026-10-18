import { useLayoutEffect, useRef, useState } from 'react';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';

export interface AudioPlayerProps {
  src?: string | null;
  label?: string;
}

type PlayerStatus = 'empty' | 'ready' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

const DEFAULT_LABEL = 'Thuyết minh audio';

function statusText(status: PlayerStatus) {
  switch (status) {
    case 'empty': return 'Chưa có audio';
    case 'loading': return 'Đang mở audio…';
    case 'playing': return 'Đang phát';
    case 'paused': return 'Đã tạm dừng';
    case 'ended': return 'Đã phát xong';
    case 'error': return 'Không phát được audio. Vui lòng thử lại.';
    default: return 'Sẵn sàng phát';
  }
}

function AudioPlayerInstance({ source, label }: { source: string | null; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<PlayerStatus>(source ? 'ready' : 'empty');
  const [isPending, setIsPending] = useState(false);

  useLayoutEffect(() => () => {
    requestRef.current += 1;
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, []);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio || isPending || !source) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setIsPending(true);
    setStatus('loading');
    try {
      if (status === 'error') audio.load();
      await audio.play();
    } catch {
      if (requestRef.current === request) setStatus('error');
    } finally {
      if (requestRef.current === request) setIsPending(false);
    }
  };

  const handlePause = () => audioRef.current?.pause();
  const isPlaying = status === 'playing';
  const isError = status === 'error';
  const buttonLabel = isError ? 'Thử lại' : isPlaying ? 'Tạm dừng' : status === 'paused' ? 'Tiếp tục' : 'Phát';

  return (
    <Paper component="section" aria-label={label} withBorder p="md" radius="md">
      <Stack gap="sm">
        <audio
          ref={audioRef}
          src={source ?? undefined}
          preload="none"
          aria-hidden="true"
          onPlaying={() => { setIsPending(false); setStatus('playing'); }}
          onPause={() => { if (status !== 'ended' && status !== 'error') setStatus('paused'); }}
          onEnded={() => { setIsPending(false); setStatus('ended'); }}
          onError={() => { setIsPending(false); setStatus('error'); }}
        />
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={600}>{label}</Text>
          <Button
            styles={{ root: { minHeight: 44 } }}
            leftSection={isPlaying ? <IconPlayerPause size={18} aria-hidden="true" /> : <IconPlayerPlay size={18} aria-hidden="true" />}
            onClick={isPlaying ? handlePause : () => void handlePlay()}
            disabled={!source}
          >
            {buttonLabel}
          </Button>
        </Group>
        <Text role={status === 'error' ? 'alert' : 'status'} aria-live="polite" size="sm" c={status === 'error' ? 'red' : 'dimmed'}>
          {statusText(status)}
        </Text>
      </Stack>
    </Paper>
  );
}

export function AudioPlayer({ src, label = DEFAULT_LABEL }: AudioPlayerProps) {
  const source = src?.trim() || null;
  return <AudioPlayerInstance key={source ?? 'empty'} source={source} label={label} />;
}
