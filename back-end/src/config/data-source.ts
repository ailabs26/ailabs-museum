import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { ContentReport } from '../modules/content-reports/entities/content-report.entity';
import { ExhibitRevision } from '../modules/exhibits/entities/exhibit-revision.entity';
import { Exhibit } from '../modules/exhibits/entities/exhibit.entity';
import { Hotspot } from '../modules/exhibits/entities/hotspot.entity';
import { Media } from '../modules/media/entities/media.entity';
import { Permission } from '../modules/roles/entities/permission.entity';
import { RefreshSession } from '../modules/auth/entities/refresh-session.entity';
import { RolePermission } from '../modules/roles/entities/role-permission.entity';
import { Role } from '../modules/roles/entities/role.entity';
import { Room } from '../modules/rooms/entities/room.entity';
import { UserRole } from '../modules/users/entities/user-role.entity';
import { User } from '../modules/users/entities/user.entity';

config();

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Room,
    Exhibit,
    ExhibitRevision,
    Hotspot,
    Media,
    User,
    Role,
    Permission,
    UserRole,
    RolePermission,
    RefreshSession,
    ContentReport,
    AuditLog,
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
});
