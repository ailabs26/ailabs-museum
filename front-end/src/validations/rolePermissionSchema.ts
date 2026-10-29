import { z } from 'zod';

export const roleSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  permissions: z.array(z.string()),
  /** Chỉ có khi xem mục Đã xóa (`deleted=true`). */
  deletedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const permissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  description: z.string().nullable(),
});

export const roleListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(roleSchema),
});

export const permissionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(permissionSchema),
});

export const permissionMatrixResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    roleIds: z.array(z.string().uuid()),
    roles: z.array(roleSchema),
  }),
});
