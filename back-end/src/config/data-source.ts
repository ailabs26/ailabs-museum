import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { ContentReport } from '../content-reports/content-report.entity';
import { ExhibitRevision } from '../exhibit-revisions/exhibit-revision.entity';
import { Exhibit } from '../exhibits/exhibit.entity';
import { Hotspot } from '../hotspots/hotspot.entity';
import { Media } from '../media/media.entity';
import { Permission } from '../permissions/permission.entity';
import { RefreshSession } from '../refresh-sessions/refresh-session.entity';
import { RolePermission } from '../role-permissions/role-permission.entity';
import { Role } from '../roles/role.entity';
import { Room } from '../rooms/room.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { User } from '../users/user.entity';

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
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
});
