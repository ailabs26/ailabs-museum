import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Media } from '../media/media.entity';

@Entity('exhibits')
export class Exhibit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) roomId!: string;
  @ManyToOne(() => Room, (room) => room.exhibits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' }) room!: Room;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'float' }) positionX!: number;
  @Column({ type: 'float' }) positionY!: number;
  @Column({ type: 'float' }) positionZ!: number;
  @Column({ type: 'varchar', length: 20 }) placeholderShape!: string;
  @Column({ type: 'varchar', length: 7 }) placeholderColor!: string;
  @Column({ type: 'int' }) displayOrder!: number;
  @Column({ type: 'text', nullable: true }) transcript!: string | null;
  @Column({ type: 'uuid', nullable: true }) modelId!: string | null;
  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'modelId' }) model!: Media | null;
  @Column({ type: 'uuid', nullable: true }) imageId!: string | null;
  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'imageId' }) image!: Media | null;
  @Column({ type: 'uuid', nullable: true }) audioId!: string | null;
  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'audioId' }) audio!: Media | null;
}
