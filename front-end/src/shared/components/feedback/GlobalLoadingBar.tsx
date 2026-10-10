import { useSyncExternalStore } from 'react';
import { loadingStore } from '@/core/api/loading-store';

/**
 * Thanh loading mảnh cố định trên cùng, hiện khi có ít nhất một request HTTP đang chạy
 * (đọc từ loadingStore). Đặt một lần ở cấp ứng dụng.
 */
export function GlobalLoadingBar() {
  const loading = useSyncExternalStore(
    loadingStore.subscribe,
    loadingStore.getSnapshot,
    loadingStore.getSnapshot,
  );

  if (!loading) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2000,
        overflow: 'hidden',
        background: 'var(--mantine-color-aura-1, rgba(0,0,0,0.05))',
      }}
    >
      <div
        style={{
          height: '100%',
          width: '40%',
          background: 'var(--mantine-color-aura-6, #4c6ef5)',
          borderRadius: 3,
          animation: 'aura-loading-slide 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes aura-loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
