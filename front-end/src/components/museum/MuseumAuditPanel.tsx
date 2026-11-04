import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, Group, NativeSelect, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { auditRecorder, museumAuditApi, startMuseumAudit, stopMuseumAudit } from '@/helpers/museumAuditBrowser';
import { analyzeMuseumAudit, type AuditMetadata } from '@/helpers/museumAuditMetrics';

/** Local manual audit controls. No background updates or telemetry. */
export function MuseumAuditPanel({ isSceneOpen, containerRef }: { isSceneOpen: boolean; containerRef: RefObject<HTMLDivElement> }) {
  const [target, setTarget] = useState<HTMLElement>(document.body);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRecording, setIsRecording] = useState(auditRecorder.isRecording);
  const downloadUrlRef = useRef<string | null>(null);
  const [message, setMessage] = useState('Chỉ đo render submissions. GPU memory/time: unavailable.');
  const [metadata, setMetadata] = useState<AuditMetadata>({ buildSha: '', device: '', conditions: '', scenario: 'P03', kind: 'continuous', source: 'live', target: 'desktop' });
  useEffect(() => { setTarget(isSceneOpen && containerRef.current ? containerRef.current : document.body); }, [isSceneOpen, containerRef]);
  useEffect(() => {
    window.museumAudit = museumAuditApi;
    return () => {
      if (auditRecorder.isRecording) stopMuseumAudit();
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      if (window.museumAudit === museumAuditApi) delete window.museumAudit;
    };
  }, []);
  const attempt = (action: () => void) => {
    try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thực hiện được audit.'); }
  };
  const update = <Key extends keyof AuditMetadata>(key: Key, value: AuditMetadata[Key]) => setMetadata(previous => ({ ...previous, [key]: value }));
  return createPortal(<Paper role="group" aria-label="Performance audit" withBorder shadow="sm" p="xs"
    style={{ position: 'fixed', zIndex: 1500, top: 95, right: 8, width: 'min(300px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 110px)', overflowY: 'auto' }}>
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" fw={700}>Performance audit</Text>
      <Button size="compact-xs" variant="default" onClick={() => setIsCollapsed(value => !value)} aria-label={isCollapsed ? 'Mở audit' : 'Thu gọn audit'}>{isCollapsed ? 'Mở' : 'Thu gọn'}</Button>
    </Group>
    {!isCollapsed && <Stack gap={6} mt={6}>
      <Group grow>
        <Button size="xs" disabled={isRecording} onClick={() => attempt(() => { startMuseumAudit(metadata); setIsRecording(true); setMessage('Đang ghi. Thu gọn panel để điều hướng; Stop sau 30–60s.'); })}>Start</Button>
        <Button size="xs" disabled={!isRecording} onClick={() => attempt(() => {
          const result = analyzeMuseumAudit(stopMuseumAudit()); setIsRecording(false);
          setMessage(`${result.renderedFrames} submissions; mean ${result.frame.meanFps?.toFixed(2) ?? 'N/A'} FPS. ${result.issues.join(', ') || 'Đủ dữ liệu để phân tích; chưa chứng nhận thiết bị.'}`);
        })}>Stop</Button>
        <Button size="xs" variant="default" disabled={isRecording} onClick={() => attempt(() => {
          const json = auditRecorder.exportJson();
          if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          downloadUrlRef.current = url;
          const link = document.createElement('a'); link.href = url; link.download = `museum-audit-${metadata.scenario}-${Date.now()}.json`;
          document.body.append(link); link.click(); link.remove();
        })}>Export JSON</Button>
      </Group>
      <TextInput size="xs" label="Build SHA" value={metadata.buildSha} disabled={isRecording} onChange={event => update('buildSha', event.currentTarget.value.trim())} />
      <TextInput size="xs" label="Thiết bị" value={metadata.device} disabled={isRecording} onChange={event => update('device', event.currentTarget.value)} />
      <Textarea size="xs" label="Điều kiện đo" description="Model/SoC/RAM/OS, browser, Hz quan sát, network, battery/thermal/power; chưa biết ghi unavailable."
        value={metadata.conditions} disabled={isRecording} onChange={event => update('conditions', event.currentTarget.value)} />
      <Group grow>
        <NativeSelect size="xs" label="Scenario" value={metadata.scenario} disabled={isRecording} data={Array.from({ length: 10 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`)} onChange={event => update('scenario', event.currentTarget.value)} />
        <NativeSelect size="xs" label="Workload" value={metadata.kind} disabled={isRecording} data={['continuous', 'idle', 'startup', 'lifecycle']} onChange={event => update('kind', event.currentTarget.value as AuditMetadata['kind'])} />
      </Group>
      <Group grow>
        <NativeSelect size="xs" label="Data source" value={metadata.source} disabled={isRecording} data={['live', 'fixture']} onChange={event => update('source', event.currentTarget.value as AuditMetadata['source'])} />
        <NativeSelect size="xs" label="Target" value={metadata.target} disabled={isRecording} data={['desktop', 'mobile']} onChange={event => update('target', event.currentTarget.value as AuditMetadata['target'])} />
      </Group>
      <Text size="xs" role="status">{message}</Text>
    </Stack>}
  </Paper>, target);
}
