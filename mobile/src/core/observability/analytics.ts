import { useEffect } from 'react';
import { isFeatureEnabled } from '@/config/env';

/**
 * Sự kiện sử dụng ẩn danh (MOB-E13-02). Chưa gửi ra ngoài: giữ trong bộ nhớ và chuyển cho sink (dev: console).
 * Chọn nhà cung cấp sau thì chỉ cần `analytics.addSink`.
 *
 * Riêng tư: chỉ ghi các trường khai báo dưới đây và đúng định dạng (id nội dung công khai, số, giá trị cố định).
 * Không có trường nhận chuỗi tự do, không ID người dùng/thiết bị/phiên.
 */
export interface AnalyticsEvents {
  room_view: { roomId: string };
  exhibit_view: { exhibitId: string; mode: 'room' | 'ar' };
  tour_start: { roomId: string; steps: number };
  tour_step: { roomId: string; step: number };
  tour_complete: { roomId: string; steps: number };
}
export type AnalyticsEventName = keyof AnalyticsEvents;

export interface AnalyticsRecord {
  at: number;
  name: AnalyticsEventName;
  props: Readonly<Record<string, string | number>>;
}

type Check = (value: unknown) => boolean;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id: Check = (value) => typeof value === 'string' && UUID.test(value);
const count: Check = (value) => Number.isInteger(value) && (value as number) >= 0;
const mode: Check = (value) => value === 'room' || value === 'ar';

const SCHEMA: { [K in AnalyticsEventName]: Record<keyof AnalyticsEvents[K], Check> } = {
  room_view: { roomId: id },
  exhibit_view: { exhibitId: id, mode },
  tour_start: { roomId: id, steps: count },
  tour_step: { roomId: id, step: count },
  tour_complete: { roomId: id, steps: count },
};

/** Giữ đúng các trường được phép; thiếu hoặc sai định dạng thì bỏ cả sự kiện (null). */
export function sanitizeEvent(name: string, props: object): AnalyticsRecord['props'] | null {
  if (!Object.hasOwn(SCHEMA, name)) return null;
  const checks = SCHEMA[name as AnalyticsEventName] as Record<string, Check>;
  const source = props as Record<string, unknown>;
  const clean: Record<string, string | number> = {};
  for (const [key, check] of Object.entries(checks)) {
    const value = source[key];
    if (!check(value)) return null;
    clean[key] = value as string | number;
  }
  return clean;
}

export type AnalyticsSink = (record: AnalyticsRecord) => void;

export class Analytics {
  private records: AnalyticsRecord[] = [];
  private readonly sinks = new Set<AnalyticsSink>();

  constructor(
    private readonly enabled: () => boolean,
    private readonly capacity = 100,
    private readonly now: () => number = Date.now,
  ) {}

  track<K extends AnalyticsEventName>(name: K, props: AnalyticsEvents[K]): void {
    if (!this.enabled()) return;
    const clean = sanitizeEvent(name, props);
    if (!clean) return;
    const record: AnalyticsRecord = { at: this.now(), name, props: clean };
    this.records = [...this.records, record].slice(-this.capacity);
    for (const sink of this.sinks) {
      try {
        sink(record);
      } catch {
        // Sink hỏng không được ảnh hưởng người dùng.
      }
    }
  }

  getRecent(): readonly AnalyticsRecord[] {
    return this.records;
  }

  addSink(sink: AnalyticsSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }
}

/** Dùng chung toàn app; tắt/bật bằng flag `analytics`. */
export const analytics = new Analytics(() => isFeatureEnabled('analytics'));

if (__DEV__ && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  analytics.addSink((record) => console.log('[analytics]', record.name, record.props));
}

/** Ghi một lượt xem mỗi khi nội dung đổi; làm mới dữ liệu cùng nội dung không tính thêm. */
export function useTrackRoomView(roomId: string | undefined): void {
  useEffect(() => {
    if (roomId) analytics.track('room_view', { roomId });
  }, [roomId]);
}

export function useTrackExhibitView(exhibitId: string | undefined, viewMode: 'room' | 'ar'): void {
  useEffect(() => {
    if (exhibitId) analytics.track('exhibit_view', { exhibitId, mode: viewMode });
  }, [exhibitId, viewMode]);
}
