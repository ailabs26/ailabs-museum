import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OFFLINE_MESSAGE, OfflineAware } from './OfflineBanner';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe('OfflineAware', () => {
  afterEach(() => act(() => onlineManager.setOnline(true)));

  it('mất mạng -> hiện banner; có mạng lại -> ẩn; màn bên dưới không bị dựng lại', () => {
    let mounts = 0;
    function Child() {
      const insets = useSafeAreaInsets();
      useEffect(() => void (mounts += 1), []);
      return <Text>top={insets.top}</Text>;
    }
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <OfflineAware>
          <Child />
        </OfflineAware>
      </SafeAreaProvider>,
    );
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(screen.getByText('top=47')).toBeTruthy();

    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_MESSAGE);
    // Banner đã chiếm vùng tai thỏ: màn bên dưới không đệm thêm lần nữa.
    expect(screen.getByText('top=0')).toBeTruthy();

    act(() => onlineManager.setOnline(true));
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(mounts).toBe(1);
  });
});
