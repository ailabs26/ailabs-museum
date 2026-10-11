import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Cần ít nhất một vai trò' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
