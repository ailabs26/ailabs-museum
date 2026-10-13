import type { ExhibitRevisionContent } from '../../modules/exhibits/entities/exhibit-revision.entity';

export const DEMO_ROOM_SLUG = 'phong-lich-su-quan-su-viet-nam';

export const DEMO_EXHIBITS: {
  id: string;
  revisionId: string;
  displayOrder: number;
  content: ExhibitRevisionContent;
}[] = [
  {
    id: 'c8a43701-5f82-4cb1-9d60-a82170000001',
    revisionId: 'e4b59201-72cd-45a8-b361-a82170000001',
    displayOrder: 0,
    content: {
      name: '[Mẫu] Mũ bảo hộ',
      description: 'Mẫu minh họa vật dụng bảo hộ cá nhân. Đây là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định; hình khối chỉ dùng để kiểm tra hiển thị.',
      position: { x: -4, y: 0, z: -4 },
      placeholderShape: 'sphere', placeholderColor: '#647552',
    },
  },
  {
    id: 'c8a43701-5f82-4cb1-9d60-a82170000002',
    revisionId: 'e4b59201-72cd-45a8-b361-a82170000002',
    displayOrder: 1,
    content: {
      name: '[Mẫu] Bình nước dã chiến',
      description: 'Mẫu minh họa bình mang nước trong hành trình dã ngoại. Đây là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định; hình khối chỉ dùng để kiểm tra hiển thị.',
      position: { x: 0, y: 0, z: -4 },
      placeholderShape: 'cylinder', placeholderColor: '#72816b',
    },
  },
  {
    id: 'c8a43701-5f82-4cb1-9d60-a82170000003',
    revisionId: 'e4b59201-72cd-45a8-b361-a82170000003',
    displayOrder: 2,
    content: {
      name: '[Mẫu] Ba lô hành quân',
      description: 'Mẫu minh họa túi đựng vật dụng cá nhân khi di chuyển. Đây là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định; hình khối chỉ dùng để kiểm tra hiển thị.',
      position: { x: 4, y: 0, z: -4 },
      placeholderShape: 'box', placeholderColor: '#8b7355',
    },
  },
  {
    id: 'c8a43701-5f82-4cb1-9d60-a82170000004',
    revisionId: 'e4b59201-72cd-45a8-b361-a82170000004',
    displayOrder: 3,
    content: {
      name: '[Mẫu] La bàn',
      description: 'Mẫu minh họa dụng cụ xác định phương hướng. Đây là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định; hình khối chỉ dùng để kiểm tra hiển thị.',
      position: { x: -3, y: 0, z: 3 },
      placeholderShape: 'torus', placeholderColor: '#b88a50',
    },
  },
  {
    id: 'c8a43701-5f82-4cb1-9d60-a82170000005',
    revisionId: 'e4b59201-72cd-45a8-b361-a82170000005',
    displayOrder: 4,
    content: {
      name: '[Mẫu] Máy thông tin liên lạc',
      description: 'Mẫu minh họa thiết bị trao đổi thông tin. Đây là dữ liệu phát triển, chưa phải hồ sơ hiện vật đã được thẩm định; hình khối chỉ dùng để kiểm tra hiển thị.',
      position: { x: 3, y: 0, z: 3 },
      placeholderShape: 'box', placeholderColor: '#457c79',
    },
  },
];
