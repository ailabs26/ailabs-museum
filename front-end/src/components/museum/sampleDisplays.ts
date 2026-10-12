import type { MuseumDisplay } from '@/interfaces/museumScene';

/** Explicit Day 1 studies. Never substitute these for a failed API response. */
export const SAMPLE_DISPLAYS: MuseumDisplay[] = [
  { id: 'orbit', title: 'Quỹ đạo', description: 'Vòng đồng mở ra khoảng trống ở tâm — nghiên cứu về cân bằng.', position: [0, 0, 0], shape: 'torus', color: '#b88a50' },
  { id: 'origin', title: 'Khởi nguyên', description: 'Khối cầu đất nung, bề mặt mờ đón ánh sáng dịu.', position: [-5.3, 0, -5.1], shape: 'sphere', color: '#a65f48' },
  { id: 'rhythm', title: 'Nhịp điệu', description: 'Các mặt đa diện xanh ngọc tạo nhịp sáng tối.', position: [5.3, 0, -5.1], shape: 'icosahedron', color: '#457c79' },
  { id: 'stillness', title: 'Tĩnh tại', description: 'Khối lập phương màu đá, hình học thuần khiết và vững chãi.', position: [-5.3, 0, 5.1], shape: 'cube', color: '#b8a68b' },
  { id: 'ascent', title: 'Vươn lên', description: 'Hình nón màu than hướng lên trần, gợi cảm giác chuyển động.', position: [5.3, 0, 5.1], shape: 'cone', color: '#3d5057' },
];
