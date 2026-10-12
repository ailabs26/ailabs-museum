import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoomStatus } from '../entities/room.entity';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên phòng không được để rỗng nếu cung cấp' })
  @MaxLength(200, { message: 'Tên phòng không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng phải là active hoặc archived' })
  status?: RoomStatus;
}
