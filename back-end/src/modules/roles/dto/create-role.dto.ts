import { Matches, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  /** Khóa role, chữ thường + gạch dưới (vd: content_editor). */
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Code chỉ gồm chữ thường, số và gạch dưới, bắt đầu bằng chữ',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
