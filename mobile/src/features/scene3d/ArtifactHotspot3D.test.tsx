import { render } from '@testing-library/react-native';
import { ArtifactHotspot3D } from './ArtifactHotspot3D';
import type { ArtifactHotspot } from './artifactHotspots';

it('giữ nguyên tọa độ của marker và phân biệt marker active bằng tỷ lệ và màu', () => {
  const hotspot: ArtifactHotspot = {
    artifactId: 'exhibit-1',
    id: 'etching',
    label: 'Hoa văn',
    body: 'Đường khắc trên bề mặt.',
    isDefault: false,
    position: [0.7, 2.5, 0.2],
  };
  const view = render(<ArtifactHotspot3D hotspot={hotspot} active={false} />);
  const mesh = view.UNSAFE_root.findByType('mesh');
  const normalColor = view.UNSAFE_root.findByType('meshBasicMaterial').props.color;

  expect(mesh.props.position).toBe(hotspot.position);
  expect(mesh.props.scale).toBe(1);
  expect(view.UNSAFE_root.findByType('sphereGeometry').props.args).toEqual([0.16, 12, 8]);

  view.rerender(<ArtifactHotspot3D hotspot={hotspot} active />);
  expect(mesh.props.position).toBe(hotspot.position);
  expect(mesh.props.scale).toBeGreaterThan(1);
  expect(view.UNSAFE_root.findByType('meshBasicMaterial').props.color).not.toBe(normalColor);
});
