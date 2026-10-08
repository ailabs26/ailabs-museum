import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;
}
