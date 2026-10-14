import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { MediaKind, MediaProcessingState } from '../entities/media.entity';

export class ListMediaQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MediaKind, { message: 'kind phải là model, image, audio hoặc subtitle' })
  kind?: MediaKind;

  @IsOptional()
  @IsEnum(MediaProcessingState, { message: 'state phải là pending, ready, failed hoặc quarantined' })
  state?: MediaProcessingState;
}
