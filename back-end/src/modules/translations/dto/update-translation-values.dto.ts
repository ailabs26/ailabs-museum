import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateTranslationValuesDto {
  /** Bản dịch cần cập nhật theo mã ngôn ngữ (merge vào bản hiện có). */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  @IsObject()
  values!: Record<string, string>;
}
