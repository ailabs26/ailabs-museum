import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exhibit } from '../exhibits/exhibit.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120, unique: true }) slug!: string;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'text' }) description!: string;
  @OneToMany(() => Exhibit, (exhibit) => exhibit.room) exhibits!: Exhibit[];
}
