import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../common/constants/permissions.constant';
import { RoleKey } from '../../common/enums/role.enum';
import { dataSource } from '../../config/data-source';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';
import { Role } from '../../modules/roles/entities/role.entity';
import { Translation } from '../../modules/translations/entities/translation.entity';
import { PartnerApiKey } from '../../modules/partner-api-keys/entities/partner-api-key.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { User } from '../../modules/users/entities/user.entity';

/** Tên hiển thị cho các role hệ thống. */
const ROLE_NAMES: Record<RoleKey, string> = {
  [RoleKey.ADMIN]: 'Quản trị viên',
  [RoleKey.MODERATOR]: 'Kiểm duyệt viên',
  [RoleKey.EDITOR]: 'Biên tập viên',
};

async function seedPermissions(): Promise<Map<string, Permission>> {
  const repo = dataSource.getRepository(Permission);
  const byCode = new Map<string, Permission>();
  for (const code of ALL_PERMISSIONS) {
    let permission = await repo.findOne({ where: { code } });
    if (!permission) {
      permission = await repo.save(repo.create({ code, description: null }));
      console.log(`  + permission ${code}`);
    }
    byCode.set(code, permission);
  }
  return byCode;
}

async function seedRoles(permissions: Map<string, Permission>): Promise<Map<RoleKey, Role>> {
  const roleRepo = dataSource.getRepository(Role);
  const linkRepo = dataSource.getRepository(RolePermission);
  const byKey = new Map<RoleKey, Role>();

  for (const key of Object.values(RoleKey)) {
    let role = await roleRepo.findOne({ where: { code: key, isDeleted: false } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ code: key, name: ROLE_NAMES[key] }));
      console.log(`  + role ${key}`);
    }
    byKey.set(key, role);

    // Đồng bộ lại toàn bộ quyền của role theo cấu hình mặc định (idempotent).
    await linkRepo.delete({ roleId: role.id });
    const codes = DEFAULT_ROLE_PERMISSIONS[key];
    const links = codes
      .map((code) => permissions.get(code))
      .filter((permission): permission is Permission => Boolean(permission))
      .map((permission) => linkRepo.create({ roleId: role!.id, permissionId: permission.id }));
    if (links.length > 0) await linkRepo.save(links);
    console.log(`  = role ${key}: ${links.length} quyền`);
  }
  return byKey;
}

async function seedAdmin(roles: Map<RoleKey, Role>): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('  ! Bỏ qua tạo admin: thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD');
    return;
  }

  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  let admin = await userRepo.findOne({ where: { email } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email,
        passwordHash: await bcrypt.hash(password, rounds),
        displayName: 'Administrator',
      }),
    );
    console.log(`  + admin ${email}`);
  }

  const adminRole = roles.get(RoleKey.ADMIN)!;
  const hasRole = await userRoleRepo.count({
    where: { userId: admin.id, roleId: adminRole.id },
  });
  if (hasRole === 0) {
    await userRoleRepo.save(userRoleRepo.create({ userId: admin.id, roleId: adminRole.id }));
    console.log('  = gán role admin cho tài khoản seed');
  }
}

/** Dữ liệu mẫu CMS i18n — chỉ seed khi bảng trống (idempotent). */
async function seedTranslations(): Promise<void> {
  const repo = dataSource.getRepository(Translation);
  if ((await repo.count()) > 0) return;
  await repo.save([
    repo.create({
      namespace: 'exhibit.trong-dong-dong-son.name', category: 'exhibit',
      context: 'Tên hiện vật hiển thị trên thẻ và trang chi tiết',
      values: { vi: 'Trống đồng Đông Sơn', en: 'Dong Son Bronze Drum' },
    }),
    repo.create({
      namespace: 'exhibit.trong-dong-dong-son.description', category: 'exhibit',
      context: 'Mô tả ngắn hiện vật (1-2 câu)',
      values: {
        vi: 'Bảo vật biểu trưng cho văn minh Đông Sơn, niên đại khoảng 2.500 năm.',
        en: 'A treasure symbolizing the Dong Son civilization, dated to around 2,500 years ago.',
      },
    }),
    repo.create({
      namespace: 'ui.cta.explore-3d', category: 'ui',
      context: 'Nút kêu gọi vào không gian 3D ở trang chủ',
      values: { vi: 'Khám phá Không gian 3D', en: 'Explore the 3D Space', fr: 'Explorer l’espace 3D' },
    }),
    repo.create({
      namespace: 'ui.collection.empty', category: 'ui',
      context: 'Thông báo khi phòng chưa có hiện vật',
      values: { vi: 'Phòng này chưa có hiện vật được xuất bản.' },
    }),
  ]);
  console.log('  + 4 chuỗi dịch mẫu');
}

/** Dữ liệu mẫu API key đối tác — khóa thô bị loại bỏ, chỉ giữ hash + phần che. */
async function seedPartnerApiKeys(): Promise<void> {
  const repo = dataSource.getRepository(PartnerApiKey);
  if ((await repo.count()) > 0) return;
  const makeHash = () => {
    const token = randomBytes(24).toString('hex');
    return { hash: createHash('sha256').update('ak_live_' + token).digest('hex'), last4: token.slice(-4) };
  };
  const a = makeHash();
  const b = makeHash();
  await repo.save([
    repo.create({
      partnerName: 'VietnamPlus', label: 'Nhúng tour cho báo điện tử',
      scopes: ['public:read', 'exhibits:read', 'tour:embed'], status: 'active',
      keyPrefix: 'ak_live_', keyHash: a.hash, last4: a.last4,
      expiresAt: new Date(Date.now() + 323 * 86_400_000), lastUsedAt: new Date(), revokedAt: null,
    }),
    repo.create({
      partnerName: 'EduTech Labs', label: 'Tích hợp giáo trình số',
      scopes: ['public:read', 'media:read', 'analytics:read'], status: 'active',
      keyPrefix: 'ak_live_', keyHash: b.hash, last4: b.last4,
      expiresAt: null, lastUsedAt: null, revokedAt: null,
    }),
  ]);
  console.log('  + 2 API key đối tác mẫu');
}

async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('Seed: permissions...');
  const permissions = await seedPermissions();
  console.log('Seed: roles + role_permissions...');
  const roles = await seedRoles(permissions);
  console.log('Seed: admin đầu tiên...');
  await seedAdmin(roles);
  console.log('Seed: dữ liệu CMS mẫu (i18n + API key)...');
  await seedTranslations();
  await seedPartnerApiKeys();
  await dataSource.destroy();
  console.log('Seed xong.');
}

run().catch((error) => {
  console.error('Seed lỗi:', error);
  process.exitCode = 1;
});
