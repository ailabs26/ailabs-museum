import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Exhibit } from '../exhibits/exhibit.entity';
import { Media } from '../media/media.entity';

config();

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Room, Exhibit, Media],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
