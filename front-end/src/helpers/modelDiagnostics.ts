export type ModelStage = 'download' | 'validate' | 'parse' | 'normalize' | 'mesh' | 'render';
export type ModelErrorCategory = 'network' | 'permission' | 'missing' | 'server' | 'format' | 'mesh' | 'render' | 'unknown';
export interface ModelFailure { stage: ModelStage; category: ModelErrorCategory }

export class ModelAssetError extends Error {
  constructor(readonly stage: ModelStage, readonly category: ModelErrorCategory) {
    super('Không thể hiển thị mô hình 3D.');
  }
}

/** Do not copy raw messages, stacks, Axios config or Storage URLs across this boundary. */
export function describeModelFailure(error: unknown): ModelFailure {
  if (error instanceof ModelAssetError) return { stage: error.stage, category: error.category };
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  return { stage: 'download', category: status === 401 || status === 403 ? 'permission' : status === 404 ? 'missing'
    : typeof status === 'number' && status >= 500 ? 'server' : status === 0 ? 'network' : 'unknown' };
}

export function reportModelFailure(event: ModelFailure & { artifactId: string; roomId?: string; attempt: number; meshCount?: number }) {
  console.warn('[museum:model]', { artifactId: event.artifactId, roomId: event.roomId,
    stage: event.stage, category: event.category, attempt: event.attempt, meshCount: event.meshCount });
}
