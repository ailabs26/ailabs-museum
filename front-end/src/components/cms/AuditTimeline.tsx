import { Badge, Text, Timeline, ThemeIcon } from '@mantine/core';
import {
  IconArchive, IconCheck, IconEye, IconEyeOff, IconPencil, IconPlus, IconPoint,
  IconTrash, IconUpload as _IconUpload, IconUserPlus, IconX,
} from '@tabler/icons-react';
import type { AuditRow } from '@/services/audit.service';
import { actorLabel } from '@/services/audit.service';

const VERB_ICON: Record<string, typeof IconPlus> = {
  create: IconPlus, update: IconPencil, delete: IconTrash, publish: _IconUpload,
  reject: IconX, hide: IconEyeOff, unhide: IconEye, resolve: IconCheck,
  dismiss: IconArchive, assign: IconUserPlus,
};

function actionColor(action: string): string {
  const verb = action.split('.').pop() ?? '';
  if (['create', 'publish', 'resolve', 'unhide'].includes(verb)) return 'teal';
  if (['update', 'assign'].includes(verb)) return 'blue';
  if (['delete', 'reject', 'denied', 'login_failed', 'login_blocked'].includes(verb)) return 'red';
  if (['login', 'logout'].includes(verb)) return 'indigo';
  if (['hide', 'dismiss'].includes(verb)) return 'orange';
  return 'gray';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Nhật ký hệ thống dạng dòng thời gian, icon phân loại theo hành động. */
export function AuditTimeline({ rows, onSelect }: { rows: readonly AuditRow[]; onSelect: (row: AuditRow) => void }) {
  if (rows.length === 0) return <Text c="dimmed" py="lg" ta="center">Chưa có nhật ký</Text>;
  return (
    <Timeline active={rows.length} bulletSize={28} lineWidth={2} color="gray">
      {rows.map((r) => {
        const verb = r.action.split('.').pop() ?? '';
        const Icon = VERB_ICON[verb] ?? IconPoint;
        const color = actionColor(r.action);
        return (
          <Timeline.Item key={r.id} color={color}
            bullet={<ThemeIcon size={24} radius="xl" color={color} variant="light"><Icon size={14} /></ThemeIcon>}
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                role="button" tabIndex={0} onClick={() => onSelect(r)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}>
                <Badge variant="light" color={color} size="sm">{r.action}</Badge>
                <Text span size="sm" c="dimmed">{r.resourceType}</Text>
              </span>
            }>
            <Text size="xs" c="dimmed">{formatTime(r.occurredAt)} · {actorLabel(r)}</Text>
            {r.reason && <Text size="sm" mt={2} lineClamp={2}>{r.reason}</Text>}
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
