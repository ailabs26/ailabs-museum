import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Trạng thái mạng dùng chung (MOB-E12-01) — một nguồn sự thật là `onlineManager` của react-query.
 * Offline: query tạm dừng (không báo lỗi), dữ liệu đã cache vẫn hiển thị; có mạng lại thì tự tải lại.
 */

/** `isInternetReachable` = null là chưa biết (vừa mở app) → coi như online để không chặn request đầu. */
export function isOnline(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Native: react-query không tự biết mạng → nối với NetInfo. Web dùng sự kiện online/offline sẵn có. */
export function bindOnlineManagerToNetInfo(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isOnline(state))),
  );
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
