import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum MediaKind { MODEL = 'model', IMAGE = 'image', AUDIO = 'audio' }

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'enum', enum: MediaKind, enumName: 'media_kind' }) kind!: MediaKind;
  @Column({ type: 'text' }) url!: string;
  @Column({ type: 'varchar', length: 120 }) mimeType!: string;
  @Column({ type: 'varchar', length: 240, nullable: true }) altText!: string | null;
}
