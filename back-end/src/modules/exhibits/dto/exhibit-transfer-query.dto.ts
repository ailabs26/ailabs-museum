import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ExhibitVisibility } from '../entities/exhibit.entity';

/** Query xuất hiện vật: cùng bộ lọc với danh sách CMS (không phân trang, không gồm thùng rác). */
export class ExportExhibitsQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'json'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'json'], { message: 'format phải là csv hoặc json' })
  format: 'csv' | 'json' = 'csv';

  @IsOptional()
  @IsUUID(undefined, { message: 'roomId phải là định dạng UUID hợp lệ' })
  roomId?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'all'], { message: 'Trạng thái lọc phải là draft, published hoặc all' })
  status?: 'draft' | 'published' | 'all';

  @IsOptional()
  @IsEnum(ExhibitVisibility, { message: 'Trạng thái hiển thị phải là visible hoặc hidden' })
  visibility?: ExhibitVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Từ khóa tìm kiếm tối đa 200 ký tự' })
  q?: string;
}

/** Query nhập: `dryRun=true` chỉ kiểm tra, không ghi gì. */
export class ImportExhibitsQueryDto {
  @ApiPropertyOptional({ type: Boolean, default: false, description: 'true: chỉ kiểm tra từng dòng, không tạo hiện vật' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'dryRun phải là true hoặc false' })
  dryRun: boolean = false;
}
