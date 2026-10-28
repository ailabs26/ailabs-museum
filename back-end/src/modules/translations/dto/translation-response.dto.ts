import { Translation, type TranslationCategory } from '../entities/translation.entity';

export interface TranslationResponse {
  id: string;
  namespace: string;
  context: string;
  category: TranslationCategory;
  values: Record<string, string>;
  updatedAt: string;
}

export function toTranslationResponse(entity: Translation): TranslationResponse {
  return {
    id: entity.id,
    namespace: entity.namespace,
    context: entity.context ?? '',
    category: entity.category,
    values: entity.values ?? {},
    updatedAt: entity.updatedAt.toISOString(),
  };
}
