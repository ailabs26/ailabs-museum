import { IsUUID } from 'class-validator';

/** Ràng buộc tham số :id là UUID hợp lệ. */
export class IdParamDto {
  @IsUUID()
  id!: string;
}
