import { IsString, MaxLength, MinLength } from 'class-validator';

/** Chỉ cho đổi tên hiển thị; code là định danh ổn định, không sửa. */
export class UpdateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
