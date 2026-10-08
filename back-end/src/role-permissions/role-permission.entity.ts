import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { Role } from '../roles/role.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
