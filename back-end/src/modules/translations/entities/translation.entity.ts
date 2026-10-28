import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Phân loại chuỗi dịch (đồng bộ với FE translations.service.ts). */
export const TRANSLATION_CATEGORIES = ['exhibit', 'room', 'ui', 'audio'] as const;
export type TranslationCategory = (typeof TRANSLATION_CATEGORIES)[number];

/**
 * Một "chuỗi nguồn" đa ngôn ngữ cho CMS i18n. `values` là JSON `{ <locale>: text }`
 * với `vi` là ngôn ngữ nguồn, các khóa còn lại là bản dịch đích.
 */
@Entity('translations')
@Check('CHK_translations_category', `"category" IN ('exhibit', 'room', 'ui', 'audio')`)
export class Translation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('UQ_translations_namespace', { unique: true })
  @Column({ type: 'varchar', length: 160 })
  namespace!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  context!: string;

  @Column({ type: 'varchar', length: 16 })
  category!: TranslationCategory;

  /** Bản dịch theo mã ngôn ngữ, ví dụ `{ "vi": "...", "en": "..." }`. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  values!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
