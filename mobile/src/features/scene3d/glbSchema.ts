import { z } from 'zod';

/**
 * Schema công khai cho mô hình 3D GLB, đồng bộ hợp đồng với `front-end/src/validations/roomSchema.ts`
 * và `back-end/src/modules/exhibits/controllers/exhibits.controller.ts` (MOB-E6-02).
 */
export const MAX_GLB_BYTES = 128 * 1024 * 1024;

export const mediaRightsSchema = z.object({
  source: z.string().nullable(),
  author: z.string().nullable(),
  license: z.string().nullable(),
});

export type MediaRights = z.infer<typeof mediaRightsSchema>;

export const publicModelSchema = z.object({
  id: z.string().uuid(),
  storageKey: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-zA-Z0-9_/-]+\.glb$/)
    .refine(
      (key) => key.split('/').every((part) => part.length > 0 && part !== '..' && part !== '.'),
      'Đường dẫn storageKey không hợp lệ.',
    ),
  sizeBytes: z.number().int().positive().max(MAX_GLB_BYTES),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  url: z
    .string()
    .regex(/^\/rooms\/[a-zA-Z0-9_-]+\/exhibits\/[a-f0-9-]+\/model\?version=[a-f0-9]{64}$/),
  rights: mediaRightsSchema.optional(),
});

export type PublicModel = z.infer<typeof publicModelSchema>;

/**
 * Ghép an toàn đường dẫn model tương đối từ API vào `apiUrl` đã cấu hình.
 * Chặn tuyệt đối URL tuyệt đối/protocol-relative hoặc đường dẫn vượt gốc API.
 */
export function resolvePublicModelUrl(apiBaseUrl: string, relativeModelUrl: string): string {
  const trimmedBase = apiBaseUrl.trim().replace(/\/+$/, '');
  const trimmedRel = relativeModelUrl.trim();
  if (!/^https?:\/\//i.test(trimmedBase)) {
    throw new Error('API base URL không hợp lệ (chỉ chấp nhận http/https).');
  }
  if (!trimmedRel.startsWith('/rooms/') || trimmedRel.startsWith('//') || trimmedRel.includes('..')) {
    throw new Error('Đường dẫn model GLB tương đối không hợp lệ.');
  }
  const baseParsed = new URL(trimmedBase);
  const fullUrl = `${trimmedBase}${trimmedRel}`;
  const fullParsed = new URL(fullUrl);
  if (fullParsed.origin !== baseParsed.origin) {
    throw new Error('URL model GLB vượt ngoài origin API cho phép.');
  }
  return fullParsed.toString();
}
