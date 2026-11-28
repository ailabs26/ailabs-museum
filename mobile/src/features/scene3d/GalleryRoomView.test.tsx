import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { GALLERY_SLOTS, mapRoomDisplays } from './gallerySlots';
import { GALLERY_PICK_TARGET } from './galleryPicking';
import { GalleryRoomView } from './GalleryRoomView';
import { ArtifactHotspot3D } from './ArtifactHotspot3D';
import { GalleryRoomDisplays3D } from './GalleryRoomComponents';
import { getArtifactHotspots } from './artifactHotspots';
import { resolveHotspotStory } from './hotspotStory';
import type { LoadedGlbAsset } from './glbLoader';
import { normalizeModel } from './glbValidation';
import type { MuseumDisplay, PublicRoomPayload } from './museumTypes';
import type { RoomModelState } from './roomModelManager';

const mockCamera = new PerspectiveCamera(60, 0.56, 0.1, 100);
const mockScene = new Scene();
const mockSetPixelRatio = jest.fn();
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
      gl: { setPixelRatio: mockSetPixelRatio },
    }),
  };
});

function tapViewport(x: number, y: number) {
  const surface = screen.getByTestId('touch-look-surface');
  const touch = { identifier: 1, pageX: x + 4, pageY: y + 24, locationX: x, locationY: y };
  const event = (touches: (typeof touch)[]) => ({
    nativeEvent: { touches, changedTouches: [touch] },
    touchHistory: {
      numberActiveTouches: touches.length,
      indexOfSingleActiveTouch: touch.identifier,
      mostRecentTimeStamp: 1,
      touchBank: [
        undefined,
        {
          touchActive: true,
          currentPageX: touch.pageX,
          currentPageY: touch.pageY,
          currentTimeStamp: 1,
        },
      ],
    },
  });
  fireEvent(surface, 'responderGrant', event([touch]));
  fireEvent(surface, 'responderStart', event([touch]));
  fireEvent(surface, 'responderEnd', event([]));
  fireEvent(surface, 'responderRelease', event([]));
}

const roomId = 'room-museum';
const annotation = (id: string, label: string, positionX = 0) => ({
  id,
  label,
  body: `Nội dung ${label}`,
  positionX,
  positionY: 2.2,
  positionZ: 0,
  displayOrder: id === 'shared' ? 0 : 1,
});

const model = {
  id: '10000000-0000-4000-8000-000000000001',
  storageKey: 'models/test.glb',
  sizeBytes: 1024,
  checksumSha256: 'a'.repeat(64),
  url: `/rooms/demo/exhibits/10000000-0000-4000-8000-000000000001/model?version=${'a'.repeat(64)}`,
};

const room: Pick<PublicRoomPayload, 'id' | 'exhibits'> = {
  id: roomId,
  exhibits: ['bronze', 'pottery', 'wood'].map((id, displayOrder) => {
    const [positionX, positionY, positionZ] = GALLERY_SLOTS[displayOrder]!.position;
    return {
      id,
      positionX,
      positionY,
      positionZ,
      displayOrder,
      roomId,
      name: id,
      description: `Hiện vật ${id}`,
      placeholderShape: 'box',
      placeholderColor: '#846A4B',
      ...(id === 'bronze'
        ? {
            model,
            hotspots: [annotation('shared', 'Hoa văn', -0.25), annotation('edge', 'Viền', 0.25)],
          }
        : id === 'pottery'
          ? { hotspots: [annotation('shared', 'Men xanh')] }
          : {}),
    };
  }),
};

function markerInstances() {
  return screen.UNSAFE_queryAllByType(ArtifactHotspot3D);
}

function tapMarker(exhibitId: string, hotspotId: string) {
  const node = markerInstances().find(
    (instance) =>
      instance.props.hotspot.artifactId === exhibitId && instance.props.hotspot.id === hotspotId,
  );
  if (!node) throw new Error(`Missing marker ${exhibitId}/${hotspotId}`);
  // Mock Canvas hosts JSX. Materialize the marker meshes so the viewport still uses real Three.js rays.
  mockScene.clear();
  let target: Mesh | undefined;
  for (const instance of markerInstances()) {
    const mesh = instance.findByType('mesh');
    const placement = new Group();
    placement.position.set(...(instance.parent?.props.position as [number, number, number]));
    const args = mesh.findByType('sphereGeometry').props.args as [number, number, number];
    const marker = new Mesh(new SphereGeometry(...args), new MeshBasicMaterial());
    marker.position.set(...(mesh.props.position as [number, number, number]));
    marker.scale.setScalar(mesh.props.scale);
    marker.userData = mesh.props.userData;
    placement.add(marker);
    mockScene.add(placement);
    if (instance === node) target = marker;
  }
  if (!target) throw new Error('Missing target mesh');
  mockCamera.updateMatrixWorld();
  const { x, y } = target.getWorldPosition(new Vector3()).project(mockCamera);
  tapViewport(((x + 1) * viewport.width) / 2, ((1 - y) * viewport.height) / 2);
}

function readyAsset(): LoadedGlbAsset {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(3, 4, 2), new MeshBasicMaterial());
  mesh.position.set(1, 2, -1);
  scene.add(mesh);
  return {
    modelId: model.id,
    checksumSha256: model.checksumSha256,
    scene,
    scenes: [scene],
    normalization: normalizeModel(scene),
    quarantinedMeshCount: 0,
    source: 'cache',
    sizeBytes: model.sizeBytes,
    loadDurationMs: 1,
  };
}

describe('GalleryRoomView (MOB-E6-04)', () => {
  beforeEach(() => {
    mockSetPixelRatio.mockClear();
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
    expect(mockSetPixelRatio).not.toHaveBeenCalled();

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
        <GalleryRoomView
          roomName="Phòng Đông Sơn"
          displays={displays}
          onSelectExhibit={onSelectExhibit}
        />
      </ThemeProvider>,
    );
    await act(async () => {});

    tapViewport(viewport.width / 2, viewport.height / 2);
    expect(onSelectExhibit).toHaveBeenCalledTimes(1);
    expect(onSelectExhibit).toHaveBeenCalledWith(displays[1]);
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/Bình gốm Chu Đậu/);
  });

  it('chọn đúng marker qua mapper, raycast và cùng handler 2D, không nhân đôi analytics', async () => {
    const onSelectExhibit = jest.fn();
    const onHotspotSelected = jest.fn();
    const onOpenAr = jest.fn();
    const loaderImpl = jest.fn(async () => {
      throw new Error('GLB unavailable');
    });
    const mapped = mapRoomDisplays(room);
    render(
      <ThemeProvider>
        <GalleryRoomView
          roomId={room.id}
          roomName="Phòng thử"
          displays={mapped}
          managerOptions={{ loaderImpl }}
          {...{ onSelectExhibit, onHotspotSelected, onOpenAr }}
        />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(markerInstances()).toHaveLength(4);

    tapMarker('bronze', 'shared');
    const firstSelection = onHotspotSelected.mock.calls[0]?.[0];
    expect(firstSelection).toEqual({
      roomId,
      exhibitId: 'bronze',
      hotspotId: 'shared',
      issuedAt: expect.any(Number),
    });
    expect(resolveHotspotStory(firstSelection, mapped[0])).toMatchObject({
      hotspot: { label: 'Hoa văn' },
    });
    tapMarker('bronze', 'edge');
    expect(
      markerInstances()
        .filter((marker) => marker.props.active)
        .map((marker) => marker.props.hotspot.id),
    ).toEqual(['edge']);
    tapMarker('pottery', 'shared');
    expect(onHotspotSelected).toHaveBeenLastCalledWith(
      expect.objectContaining({ exhibitId: 'pottery', hotspotId: 'shared' }),
    );
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/pottery/);
    fireEvent.press(screen.getByRole('button', { name: 'Xem pottery trong AR' }));
    expect(onOpenAr).toHaveBeenCalledWith(mapped[1]);

    tapMarker('wood', 'wood:default');
    expect(onHotspotSelected).toHaveBeenCalledTimes(3);
    expect(onSelectExhibit.mock.calls.map(([item]) => item.id)).toEqual([
      'bronze',
      'bronze',
      'pottery',
      'wood',
    ]);
    expect(loaderImpl).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Chuyển sang danh sách hiện vật 2D' }));
    fireEvent.press(screen.getByRole('button', { name: 'Điểm tương tác bronze, Viền' }));
    expect(
      screen.getByRole('button', { name: 'Điểm tương tác bronze, Viền', selected: true }),
    ).toBeOnTheScreen();
    expect(onHotspotSelected).toHaveBeenLastCalledWith(
      expect.objectContaining({ exhibitId: 'bronze', hotspotId: 'edge' }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Quay lại phòng trưng bày 3D' }));
    expect(
      markerInstances()
        .filter((marker) => marker.props.active)
        .map((marker) => marker.props.hotspot.id),
    ).toEqual(['edge']);
  });

  it('giữ identity qua refetch, xóa khi chọn exhibit, mất hotspot/exhibit hoặc đổi phòng', async () => {
    const onHotspotSelected = jest.fn();
    const onSelectExhibit = jest.fn();
    const managerOptions = {
      loaderImpl: jest.fn(async () => {
        throw new Error('GLB unavailable');
      }),
    };
    const viewRoom = (payload: typeof room) => (
      <ThemeProvider>
        <GalleryRoomView
          roomId={payload.id}
          roomName="Phòng thử"
          initialMode="2d"
          displays={mapRoomDisplays(payload)}
          {...{ onSelectExhibit, onHotspotSelected, managerOptions }}
        />
      </ThemeProvider>
    );
    const view = render(viewRoom(room));
    await act(async () => {});
    const option = 'Điểm tương tác bronze, Viền';
    const selectEdge = () => fireEvent.press(screen.getByRole('button', { name: option }));
    selectEdge();
    const selection = onHotspotSelected.mock.calls[0]?.[0];
    const updatedRoom = {
      ...room,
      exhibits: room.exhibits.map((exhibit) =>
        exhibit.id === 'bronze'
          ? {
              ...exhibit,
              hotspots: exhibit.hotspots?.map((point) => ({ ...point, body: 'Cập nhật' })),
            }
          : exhibit,
      ),
    };
    view.rerender(viewRoom(updatedRoom));
    expect(screen.getByRole('button', { name: option, selected: true })).toBeOnTheScreen();
    expect(resolveHotspotStory(selection, mapRoomDisplays(updatedRoom)[0])?.hotspot.body).toBe(
      'Cập nhật',
    );
    expect(onHotspotSelected).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('bronze', { exact: true }));
    expect(screen.getByRole('button', { name: option, selected: false })).toBeOnTheScreen();

    selectEdge();
    view.rerender(
      viewRoom({
        ...room,
        exhibits: room.exhibits.map((exhibit) => ({
          ...exhibit,
          hotspots: exhibit.hotspots?.filter((point) => point.id !== 'edge'),
        })),
      }),
    );
    expect(screen.queryByRole('button', { name: option })).toBeNull();
    view.rerender(viewRoom(room));
    expect(screen.getByRole('button', { name: option, selected: false })).toBeOnTheScreen();

    selectEdge();
    view.rerender(
      viewRoom({ ...room, exhibits: room.exhibits.filter((exhibit) => exhibit.id !== 'bronze') }),
    );
    expect(screen.getByTestId('gallery-selected-card')).toHaveTextContent(/pottery/);
    view.rerender(viewRoom(room));
    expect(screen.getByRole('button', { name: option, selected: false })).toBeOnTheScreen();

    selectEdge();
    view.rerender(viewRoom({ ...room, id: 'different-room' }));
    expect(screen.getByRole('button', { name: option, selected: false })).toBeOnTheScreen();
    view.rerender(viewRoom(room));
    expect(screen.getByRole('button', { name: option, selected: false })).toBeOnTheScreen();
    await act(async () => {});
  });

  it('từ chối hit có hotspot ID không tồn tại trong dữ liệu hiện tại', async () => {
    const onHotspotSelected = jest.fn();
    const onSelectExhibit = jest.fn();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.userData = { [GALLERY_PICK_TARGET]: { exhibitId: 'pottery', hotspotId: 'deleted' } };
    mockScene.add(mesh);
    render(
      <ThemeProvider>
        <GalleryRoomView
          roomId={room.id}
          roomName="Phòng thử"
          displays={mapRoomDisplays({ ...room, exhibits: room.exhibits.slice(1) })}
          {...{ onHotspotSelected, onSelectExhibit }}
        />
      </ThemeProvider>,
    );
    await act(async () => {});
    tapViewport(viewport.width / 2, viewport.height / 2);
    expect(onSelectExhibit).not.toHaveBeenCalled();
    expect(onHotspotSelected).not.toHaveBeenCalled();
  });

  it('dùng một normalization cho GLB và marker trong slot, giữ fallback khi tải, lỗi hoặc checksum cũ', () => {
    const mapped = mapRoomDisplays(room);
    const display = mapped[0]!;
    const asset = readyAsset();
    const renderScene = (state: RoomModelState, displays = mapped) => (
      <GalleryRoomDisplays3D
        displays={displays}
        modelStates={new Map([[display.id, state]])}
        selectedExhibitId={display.id}
        activeHotspotSelection={{ roomId, exhibitId: display.id, hotspotId: 'edge', issuedAt: 1 }}
      />
    );
    const marker = () => markerInstances().find((instance) => instance.props.hotspot.id === 'edge');
    const view = render(renderScene({ status: 'loading', progress: 0.5 }));
    expect(marker()?.props.hotspot.position).toEqual(getArtifactHotspots(display)[1]!.position);
    expect(marker()?.parent?.props.name).toBe('slot-S01');
    expect(markerInstances()).toHaveLength(4);
    view.rerender(renderScene({ status: 'ready', asset }));
    expect(marker()?.props.hotspot.position).toEqual(
      getArtifactHotspots(display, asset.normalization)[1]!.position,
    );
    expect(marker()?.parent?.props.position).toEqual([0, 0, -2]);
    expect(marker()?.parent?.props.scale).toBeUndefined();
    expect(marker()?.props.active).toBe(true);
    expect(view.UNSAFE_root.findByType('primitive').props.object).not.toBe(asset.scene);
    view.rerender(
      renderScene({ status: 'ready', asset }, [
        { ...display, model: { ...model, checksumSha256: 'b'.repeat(64) } },
      ]),
    );
    expect(marker()?.props.hotspot.position).toEqual(getArtifactHotspots(display)[1]!.position);
    expect(view.UNSAFE_root.findAllByType('primitive')).toHaveLength(0);
    view.rerender(
      renderScene({ status: 'error', message: 'GLB unavailable', category: 'missing' }),
    );
    expect(marker()?.props.hotspot.position).toEqual(getArtifactHotspots(display)[1]!.position);
  });

  it('chọn marker legacy và bỏ marker của hiện vật ngoài phòng', async () => {
    const mapped = mapRoomDisplays({
      ...room,
      exhibits: room.exhibits.map((exhibit) =>
        exhibit.id === 'pottery'
          ? { ...exhibit, positionX: 2, positionY: 0.1, positionZ: 1.5 }
          : exhibit.id === 'wood'
            ? { ...exhibit, positionX: 10 }
            : exhibit,
      ),
    });
    const onHotspotSelected = jest.fn();
    const managerOptions = {
      loaderImpl: jest.fn(async () => {
        throw new Error('GLB unavailable');
      }),
    };
    render(
      <ThemeProvider>
        <GalleryRoomView
          roomId={room.id}
          roomName="Legacy"
          displays={mapped}
          {...{ managerOptions, onHotspotSelected }}
        />
      </ThemeProvider>,
    );
    await act(async () => {});
    const markers = markerInstances();
    expect(markers).toHaveLength(3);
    const marker = markers.find((instance) => instance.props.hotspot.artifactId === 'pottery');
    expect(marker?.parent?.props.position).toEqual([2, 0.1, 1.5]);
    expect(marker?.props.hotspot.position).toEqual([0, 2.2, 0]);
    tapMarker('pottery', 'shared');
    expect(onHotspotSelected).toHaveBeenCalledWith(
      expect.objectContaining({ exhibitId: 'pottery', hotspotId: 'shared' }),
    );
  });
});
