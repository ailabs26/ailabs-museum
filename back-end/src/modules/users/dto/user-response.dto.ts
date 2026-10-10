import { User } from '../entities/user.entity';

/** Hình dạng user trả ra API — không bao giờ gồm passwordHash. */
export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    roles: (user.userRoles ?? [])
      .map((userRole) => userRole.role?.code)
      .filter((code): code is string => Boolean(code)),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
