import { Check, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { UserRole } from '../../users/entities/user-role.entity';

@Entity('roles')
@Check('CHK_roles_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
// Mã chỉ duy nhất trong các vai trò chưa xóa (xóa mềm rồi tạo lại cùng mã được).
@Index('UQ_roles_code_active', ['code'], { unique: true, where: '"is_deleted" = false' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles!: UserRole[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
