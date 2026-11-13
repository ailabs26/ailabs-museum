import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

/** Từ chối revision — bắt buộc nêu lý do, kèm version optimistic lock. */
export class RejectRevisionDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  version!: number;

  @ApiProperty({ example: 'Mô tả chưa đúng niên đại hiện vật' })
  @IsString()
  @IsNotEmpty({ message: 'Phải nêu lý do từ chối' })
  @MaxLength(1000)
  reason!: string;
}
