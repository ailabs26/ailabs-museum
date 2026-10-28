/** Scope hợp lệ cấp cho đối tác (đồng bộ với FE apiKeys.service.ts). */
export const API_SCOPES = [
  'public:read',
  'exhibits:read',
  'rooms:read',
  'media:read',
  'tour:embed',
  'analytics:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
