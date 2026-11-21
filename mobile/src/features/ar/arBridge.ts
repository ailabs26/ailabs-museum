import type { ComponentType } from 'react';

/**
 * Cầu nối tải lười `@reactvision/react-viro` (MOB-E9-01).
 * Giúp mọi màn hình vẫn đóng gói và chạy an toàn trên Expo Go, Simulator và Jest mà không crash
 * khi thiếu binary native ViroKit / ARCore.
 */
export type ArTrackingQuality = 'initializing' | 'normal' | 'limited' | 'unavailable';

export interface ViroRuntimeComponents {
  ViroARSceneNavigator: ComponentType<Record<string, unknown>>;
  ViroARScene: ComponentType<Record<string, unknown>>;
  ViroARPlaneSelector: ComponentType<Record<string, unknown>>;
  ViroNode: ComponentType<Record<string, unknown>>;
  ViroBox: ComponentType<Record<string, unknown>>;
  ViroSphere: ComponentType<Record<string, unknown>>;
  Viro3DObject: ComponentType<Record<string, unknown>>;
  ViroText: ComponentType<Record<string, unknown>>;
  ViroAmbientLight: ComponentType<Record<string, unknown>>;
  ViroDirectionalLight: ComponentType<Record<string, unknown>>;
  ViroMaterials?: {
    createMaterials: (materials: Record<string, Record<string, unknown>>) => void;
  };
}

/** Ánh xạ mã trạng thái tracking của ARKit/ARCore (ViroTrackingStateConstants) sang trạng thái UI. */
export function mapViroTrackingState(state: number, reason?: number): {
  quality: ArTrackingQuality;
  label: string;
} {
  // Theo chuẩn ViroTrackingStateConstants: 1 = UNAVAILABLE, 2 = LIMITED, 3 = NORMAL.
  if (state === 3) {
    return { quality: 'normal', label: 'AR Tracking ổn định — chạm để đặt hiện vật' };
  }
  if (state === 2) {
    const hint =
      reason === 2
        ? 'Di chuyển máy chậm lại để nhận diện mặt phẳng'
        : reason === 3
          ? 'Bề mặt thiếu chi tiết hoặc thiếu ánh sáng'
          : 'Đang hiệu chỉnh không gian AR...';
    return { quality: 'limited', label: hint };
  }
  if (state === 1) {
    return {
      quality: 'unavailable',
      label: 'Chưa nhận được tín hiệu camera AR — kiểm tra quyền camera',
    };
  }
  return { quality: 'initializing', label: 'Đang khởi tạo phiên AR...' };
}

/** Tải động `@reactvision/react-viro` và trả `null` nếu runtime không khả dụng. */
export function loadViroRuntime(): ViroRuntimeComponents | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@reactvision/react-viro') as Partial<ViroRuntimeComponents>;
    if (!mod.ViroARSceneNavigator || !mod.ViroARScene) {
      return null;
    }
    return mod as ViroRuntimeComponents;
  } catch {
    return null;
  }
}
