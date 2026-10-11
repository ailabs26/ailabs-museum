import { NotFoundException } from '@nestjs/common';

/** Không tìm thấy tài nguyên -> 404. Vd: EntityNotFoundException('Exhibit', id). */
export class EntityNotFoundException extends NotFoundException {
  constructor(entity: string, id?: string) {
    super(id ? `Không tìm thấy ${entity} với id '${id}'` : `Không tìm thấy ${entity}`);
  }
}
