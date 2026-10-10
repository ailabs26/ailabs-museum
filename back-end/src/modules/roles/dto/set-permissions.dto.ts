import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Đặt lại TOÀN BỘ tập quyền của role theo danh sách permission code. */
export class SetPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
