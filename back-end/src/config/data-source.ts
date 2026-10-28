import 'reflect-metadata';
import { readFileSync } from 'node:fs';
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
import { Translation } from '../modules/translations/entities/translation.entity';
import { PartnerApiKey } from '../modules/partner-api-keys/entities/partner-api-key.entity';
import { UserRole } from '../modules/users/entities/user-role.entity';
import { User } from '../modules/users/entities/user.entity';

config();

/**
 * TLS cho kết nối DB (Supabase bắt buộc). Có `DATABASE_SSL_CA` → xác thực chứng chỉ bằng CA
 * của Supabase; không có → vẫn mã hóa nhưng không xác thực chứng chỉ (chỉ nên dùng tạm).
 */
function sslOptions() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  const caPath = process.env.DATABASE_SSL_CA;
  return caPath ? { ca: readFileSync(caPath, 'utf8') } : { rejectUnauthorized: false };
}

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: sslOptions(),
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
    Translation,
    PartnerApiKey,
  ],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
});
