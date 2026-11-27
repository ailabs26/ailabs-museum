import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { GALLERY_SLOTS } from './gallerySlots';
import { GALLERY_PICK_TARGET } from './galleryPicking';
import { GalleryRoomView } from './GalleryRoomView';
import type { MuseumDisplay } from './museumTypes';

const mockCamera = new PerspectiveCamera(60, 0.56, 0.1, 100);
const mockScene = new Scene();
const viewport = { width: 390, height: 700 };

jest.mock('@react-three/fiber/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Canvas: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'mock-gallery-canvas' }, children),
    useFrame: jest.fn(),
    useThree: () => ({
      camera: mockCamera,
      scene: mockScene,
      size: viewport,
      gl: { setPixelRatio: jest.fn() },
    }),
  };
});

function tapViewport(x: number, y: number) {
  const surface = screen.getByTestId('touch-look-surface');
  const touch = { identifier: 1, pageX: x + 4, pageY: y + 24, locationX: x, locationY: y };
  const event = (touches: typeof touch[]) => ({
    nativeEvent: { touches, changedTouches: [touch] },
    touchHistory: {
      numberActiveTouches: touches.length,
      indexOfSingleActiveTouch: touch.identifier,
      mostRecentTimeStamp: 1,
      touchBank: [undefined, {
        touchActive: true, currentPageX: touch.pageX, currentPageY: touch.pageY, currentTimeStamp: 1,
      }],
    },
  });
  fireEvent(surface, 'responderGrant', event([touch]));
  fireEvent(surface, 'responderStart', event([touch]));
  fireEvent(surface, 'responderEnd', event([]));
  fireEvent(surface, 'responderRelease', event([]));
}

describe('GalleryRoomView (MOB-E6-04)', () => {
  beforeEach(() => {
    mockScene.clear();
    mockCamera.position.set(0, 0, 6);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
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

  it('hiển thị phòng 3D chuẩn 5 bục, chuyển đổi mượt sang danh sách 2D và chọn hiện vật', async () => {
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
    await act(async () => {});

    expect(screen.getByTestId('gallery-3d-viewport')).toBeOnTheScreen();
    expect(screen.getByTestId('gallery-layout-badge')).toHaveTextContent(
      /Bố cục chuẩn 5 bục \(2\/5 hiện vật\)/,
    );
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Trống đồng Ngọc Lũ/);

    // Đổi chế độ chất lượng 3D bằng nút pill (Auto -> Thấp -> Cân bằng).
    const qualityBtn = screen.getByTestId('gallery-quality-toggle');
    fireEvent.press(qualityBtn);
    expect(qualityBtn).toHaveTextContent(/Thấp/);
    fireEvent.press(qualityBtn);
    expect(qualityBtn).toHaveTextContent(/Cân bằng/);

    // Chuyển sang chế độ danh sách 2D dễ tiếp cận.
    fireEvent.press(screen.getByRole('button', { name: 'Chuyển sang danh sách hiện vật 2D' }));
    expect(screen.getByTestId('gallery-2d-list')).toBeOnTheScreen();

    // Chọn hiện vật thứ 2 trong danh sách 2D.
    fireEvent.press(screen.getByText('Bình gốm Chu Đậu'));
    expect(onSelect).toHaveBeenCalledWith(displays[1]);
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Bình gốm Chu Đậu/);
  });

  it('nhận diện chính xác bố cục legacy khi hiện vật đặt tọa độ tự do', async () => {
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
    await act(async () => {});

    expect(screen.getByTestId('gallery-layout-badge')).toHaveTextContent(/Bố cục tự do/);
  });

  it('tap vùng nhìn raycast và chọn exhibit trước mặt đúng một lần', async () => {
    const onSelectExhibit = jest.fn();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.userData = { [GALLERY_PICK_TARGET]: { exhibitId: displays[1]!.id } };
    mockScene.add(mesh);
    render(
      <ThemeProvider>
        <GalleryRoomView roomName="Phòng Đông Sơn" displays={displays} onSelectExhibit={onSelectExhibit} />
      </ThemeProvider>,
    );
    await act(async () => {});

    tapViewport(viewport.width / 2, viewport.height / 2);
    expect(onSelectExhibit).toHaveBeenCalledTimes(1);
    expect(onSelectExhibit).toHaveBeenCalledWith(displays[1]);
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Bình gốm Chu Đậu/);
  });
});
