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

/** `public:read` bao trùm mọi scope đọc nội dung công khai (không gồm analytics). */
const PUBLIC_READ_COVERS: ReadonlySet<string> = new Set(['rooms:read', 'exhibits:read', 'media:read', 'tour:embed']);

/** Key có đủ scope mà route yêu cầu không. */
export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  return granted.includes(required) || (PUBLIC_READ_COVERS.has(required) && granted.includes('public:read'));
}
