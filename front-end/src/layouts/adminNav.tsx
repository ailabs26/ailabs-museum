import {
  IconLayoutDashboard, IconBuildingArch, IconArtboard, IconPhoto, IconChecklist,
  IconFlag, IconUsers, IconShieldLock, IconKey, IconHistory,
} from '@tabler/icons-react';
import { PERMISSIONS } from '@/core/auth/permissions';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof IconLayoutDashboard;
  anyOf?: string[];
  allOf?: string[];
  /** Số lượng động hiển thị dạng badge trên menu (chờ duyệt, báo cáo…). */
  badgeKey?: 'inReview' | 'reportsOpen';
  /** Từ khóa phụ cho Command Palette. */
  keywords?: string;
}

export const ADMIN_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Tổng quan',
    items: [{ label: 'Dashboard', to: '/admin', icon: IconLayoutDashboard, keywords: 'tong quan overview thong ke' }],
  },
  {
    section: 'Nội dung',
    items: [
      { label: 'Phòng trưng bày', to: '/admin/rooms', icon: IconBuildingArch, anyOf: [PERMISSIONS.ROOM_READ], keywords: 'room gallery' },
      { label: 'Hiện vật', to: '/admin/exhibits', icon: IconArtboard, anyOf: [PERMISSIONS.EXHIBIT_READ], keywords: 'exhibit artifact co vat' },
      { label: 'Media', to: '/admin/media', icon: IconPhoto, anyOf: [PERMISSIONS.MEDIA_UPLOAD], keywords: 'anh audio glb file' },
      { label: 'Kiểm duyệt', to: '/admin/moderation', icon: IconChecklist, anyOf: [PERMISSIONS.REVISION_PUBLISH], badgeKey: 'inReview', keywords: 'duyet review publish' },
      { label: 'Báo cáo vi phạm', to: '/admin/reports', icon: IconFlag, anyOf: [PERMISSIONS.REPORT_READ], badgeKey: 'reportsOpen', keywords: 'report vi pham' },
    ],
  },
  {
    section: 'Quản trị hệ thống',
    items: [
      { label: 'Tài khoản', to: '/admin/users', icon: IconUsers, anyOf: [PERMISSIONS.USER_READ], keywords: 'user account' },
      { label: 'Vai trò', to: '/admin/roles', icon: IconShieldLock, anyOf: [PERMISSIONS.ROLE_READ], keywords: 'role rbac' },
      { label: 'Danh sách quyền', to: '/admin/permissions', icon: IconKey, anyOf: [PERMISSIONS.PERMISSION_READ], keywords: 'permission quyen' },
      { label: 'Ma trận phân quyền', to: '/admin/permission-matrix', icon: IconShieldLock, allOf: [PERMISSIONS.PERMISSION_READ, PERMISSIONS.ROLE_READ], keywords: 'matrix rbac' },
      { label: 'Nhật ký hệ thống', to: '/admin/audit', icon: IconHistory, anyOf: [PERMISSIONS.AUDIT_READ], keywords: 'audit log nhat ky' },
    ],
  },
];
