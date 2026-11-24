import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { bindOnlineManagerToNetInfo, isOnline } from './online-status';

describe('online-status', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('isOnline: chỉ offline khi chắc chắn mất kết nối', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: null, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('NetInfo báo mất mạng / có mạng lại -> onlineManager đổi theo', () => {
    bindOnlineManagerToNetInfo();
    const listener = (NetInfo.addEventListener as jest.Mock).mock.calls.at(-1)?.[0] as (s: object) => void;
    listener({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);
    listener({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });
});
