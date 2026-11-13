import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MediaKind } from '../entities/media.entity';
import { UpdateMediaDto } from './update-media.dto';

/**
 * Các trường text đi kèm file trong `multipart/form-data`. File nằm ở field `file`
 * (do multer tách riêng, không thuộc DTO này).
 */
export class UploadMediaDto extends UpdateMediaDto {
  @ApiPropertyOptional({
    enum: MediaKind,
    description: 'Loại media mong đợi. Nếu gửi, nội dung file thực tế phải khớp, ngược lại trả 422.',
  })
  @IsOptional()
  @IsEnum(MediaKind, { message: 'kind phải là model, image, audio hoặc subtitle' })
  kind?: MediaKind;
}
