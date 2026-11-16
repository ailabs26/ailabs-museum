import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { BilingualDescriptionDto, BilingualNameDto } from '../../exhibits/dto/bilingual-text.dto';

/** Bản dịch gửi lên từ CMS; khóa `vi` bị bỏ qua vì tiếng Việt nằm ở `name`, `description`. */
export class RoomTranslationsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BilingualNameDto)
  name?: BilingualNameDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BilingualDescriptionDto)
  description?: BilingualDescriptionDto;
}
