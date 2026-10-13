import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  status: z.enum(['active', 'disabled']),
  roles: z.array(z.string()),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const userResponseSchema = z.object({
  success: z.literal(true),
  data: userSchema,
});

export const userListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userSchema),
  meta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

export type UserRow = z.infer<typeof userSchema>;
