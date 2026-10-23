import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';

export interface AudioPlayerProps {
  src?: string | null;
  label?: string;
  subtitleUrl?: string | null;
  locale?: 'vi' | 'en';
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

function AudioPlayerInstance({ source, label, subtitleUrl, locale }: { source: string | null; label: string; subtitleUrl?: string | null; locale: 'vi' | 'en' }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const volumeId = useId();
  const requestRef = useRef(0);
  const hasMediaErrorRef = useRef(false);
  const [status, setStatus] = useState<PlayerStatus>(source ? 'ready' : 'empty');
  const [isPending, setIsPending] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [caption, setCaption] = useState('');
  const [subtitleFailed, setSubtitleFailed] = useState(false);
  const updateCaption = useCallback(() => setCaption(Array.from(trackRef.current?.track.activeCues ?? [])
    .map(cue => (cue as VTTCue).getCueAsHTML().textContent ?? '').join('\n')), []);

  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (source) audio.setAttribute('src', source);
    const pauseForOtherGuide = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLAudioElement && target !== audio && target.dataset.guideAudio === 'true') {
        requestRef.current += 1;
        setIsPending(false);
        audio.pause();
      }
    };
    document.addEventListener('play', pauseForOtherGuide, true);
    return () => {
      requestRef.current += 1;
      document.removeEventListener('play', pauseForOtherGuide, true);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [source]);

  useLayoutEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    const track = element.track;
    const handleSubtitleError = () => { setSubtitleFailed(true); setCaption(''); };
    track.mode = 'hidden';
    track.addEventListener('cuechange', updateCaption);
    element.addEventListener('error', handleSubtitleError);
    return () => {
      track.removeEventListener('cuechange', updateCaption);
      element.removeEventListener('error', handleSubtitleError);
      track.mode = 'disabled';
    };
  }, [subtitleUrl, updateCaption]);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio || isPending || !source) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    hasMediaErrorRef.current = false;
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
  const handleStop = () => {
    requestRef.current += 1;
    setIsPending(false);
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setCaption('');
    setStatus(source ? 'ready' : 'empty');
  };
  const isPlaying = status === 'playing';
  const isError = status === 'error';
  const buttonLabel = isError ? 'Thử lại' : isPlaying ? 'Tạm dừng' : status === 'paused' ? 'Tiếp tục' : 'Phát';

  return (
    <Paper component="section" aria-label={label} withBorder p="md" radius="md">
      <Stack gap="sm">
        <audio
          ref={audioRef}
          data-guide-audio="true"
          src={source ?? undefined}
          crossOrigin="anonymous"
          preload="none"
          aria-hidden="true"
          onPlaying={() => { if (!hasMediaErrorRef.current) { setIsPending(false); setStatus('playing'); updateCaption(); } }}
          onPause={() => setStatus(current => current === 'playing' || current === 'loading' ? 'paused' : current)}
          onEnded={() => { setIsPending(false); setStatus('ended'); }}
          onError={() => { hasMediaErrorRef.current = true; requestRef.current += 1; setIsPending(false); setStatus('error'); }}
        >
          {source && subtitleUrl && <track ref={trackRef} kind="subtitles" src={subtitleUrl} srcLang={locale} />}
        </audio>
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
          <Button variant="default" styles={{ root: { minHeight: 44 } }} onClick={handleStop} disabled={!source}>Dừng</Button>
        </Group>
        <label htmlFor={volumeId}>Âm lượng</label>
        <input id={volumeId} type="range" min="0" max="1" step="0.1" defaultValue="1" disabled={!source}
          style={{ width: '100%', minHeight: 44 }} onChange={event => { if (audioRef.current) audioRef.current.volume = Number(event.target.value); }} />
        {source && subtitleUrl && <>
          <Button variant="subtle" styles={{ root: { minHeight: 44 } }} aria-pressed={captionsEnabled}
            onClick={() => setCaptionsEnabled(enabled => !enabled)}>{captionsEnabled ? 'Tắt phụ đề' : 'Bật phụ đề'}</Button>
          {subtitleFailed ? <Text role="alert" size="sm">Không tải được phụ đề. Bạn vẫn có thể đọc bản thuyết minh.</Text>
            : captionsEnabled && <Text component="p" aria-label="Phụ đề hiện tại" style={{ whiteSpace: 'pre-line' }}>{caption}</Text>}
        </>}
        <Text role={status === 'error' ? 'alert' : 'status'} aria-live="polite" size="sm" c={status === 'error' ? 'red' : 'dimmed'}>
          {statusText(status)}
        </Text>
      </Stack>
    </Paper>
  );
}

export function AudioPlayer({ src, label = DEFAULT_LABEL, subtitleUrl, locale = 'vi' }: AudioPlayerProps) {
  const source = src?.trim() || null;
  return <AudioPlayerInstance key={JSON.stringify([source, subtitleUrl, locale])} source={source} label={label} subtitleUrl={subtitleUrl} locale={locale} />;
}
