import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RolePermissionUpdateDto {
  @IsUUID()
  roleId!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

/** Cập nhật nhiều cột của ma trận quyền trong cùng một transaction. */
export class SetPermissionMatrixDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionUpdateDto)
  updates!: RolePermissionUpdateDto[];
}
