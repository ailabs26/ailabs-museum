import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { GALLERY_SLOTS } from './gallerySlots';
import { GalleryRoomView } from './GalleryRoomView';
import type { MuseumDisplay } from './museumTypes';

jest.mock('@react-three/fiber/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'mock-gallery-canvas' }, children),
  };
});

describe('GalleryRoomView (MOB-E6-04)', () => {
  const displays: MuseumDisplay[] = [
    {
      id: 'ex-1',
      title: 'Trống đồng Ngọc Lũ',
      description: 'Hiện vật trung tâm S01',
      position: [...GALLERY_SLOTS[0]!.position],
      shape: 'torus',
      color: '#B45309',
    },
    {
      id: 'ex-2',
      title: 'Bình gốm Chu Đậu',
      description: 'Hiện vật Bục S02',
      position: [...GALLERY_SLOTS[1]!.position],
      shape: 'cylinder',
      color: '#0F766E',
    },
  ];

  it('hiển thị phòng 3D chuẩn 5 bục, chuyển đổi mượt sang danh sách 2D và chọn hiện vật', () => {
    const onSelect = jest.fn();
    render(
      <ThemeProvider>
        <GalleryRoomView
          roomName="Phòng Đông Sơn"
          displays={displays}
          onSelectExhibit={onSelect}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('gallery-3d-viewport')).toBeOnTheScreen();
    expect(screen.getByTestId('gallery-layout-badge')).toHaveTextContent(
      /Bố cục chuẩn 5 bục \(2\/5 hiện vật\)/,
    );
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Trống đồng Ngọc Lũ/);

    // Chuyển sang chế độ danh sách 2D dễ tiếp cận.
    fireEvent.press(screen.getByRole('button', { name: 'Chuyển sang danh sách hiện vật 2D' }));
    expect(screen.getByTestId('gallery-2d-list')).toBeOnTheScreen();

    // Chọn hiện vật thứ 2 trong danh sách 2D.
    fireEvent.press(screen.getByText('Bình gốm Chu Đậu'));
    expect(onSelect).toHaveBeenCalledWith(displays[1]);
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Bình gốm Chu Đậu/);
  });

  it('nhận diện chính xác bố cục legacy khi hiện vật đặt tọa độ tự do', () => {
    const legacyDisplays: MuseumDisplay[] = [
      {
        id: 'free-1',
        title: 'Hiện vật tự do',
        description: 'Tọa độ tự do',
        position: [1.5, 0, 1.5],
        shape: 'cube',
        color: '#2563EB',
      },
    ];

    render(
      <ThemeProvider>
        <GalleryRoomView roomName="Phòng Legacy" displays={legacyDisplays} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('gallery-layout-badge')).toHaveTextContent(/Bố cục tự do/);
  });
});
