import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { ApiException } from '@/core/api/api-error';
import { AppErrorFallback, describeError } from './AppErrorFallback';

describe('AppErrorFallback', () => {
  it('thông điệp thân thiện theo loại lỗi', () => {
    expect(describeError(new ApiException('x', 0))).toMatch(/Không có kết nối mạng/);
    expect(describeError(new Error('undefined is not a function'))).toMatch(/gặp lỗi khi hiển thị/);
  });

  it('màn bị lỗi khi render -> hiện màn lỗi thay vì crash; Thử lại render lại màn', async () => {
    let shouldThrow = true;
    function Exhibit() {
      if (shouldThrow) throw new ApiException('Network Error', 0);
      return <Text>Nội dung hiện vật</Text>;
    }
    // Giảm nhiễu log lỗi React khi cố ý ném lỗi trong render.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    renderRouter({
      _layout: { default: () => <Slot />, ErrorBoundary: AppErrorFallback },
      index: Exhibit,
    });

    expect(screen.getByRole('header', { name: 'Đã xảy ra sự cố' })).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/Không có kết nối mạng/);

    shouldThrow = false;
    fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Nội dung hiện vật')).toBeTruthy());
    spy.mockRestore();
  });
});
