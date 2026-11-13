import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelStorageService } from '../../media/services/model-storage.service';
import { ExhibitsService } from './exhibits.service';

@Injectable()
export class PublicModelsService {
  constructor(private readonly exhibits: ExhibitsService, private readonly storage: ModelStorageService) {}
  async open(slug: string, exhibitId: string, version?: string, signal?: AbortSignal) {
    const room = await this.exhibits.roomWithExhibits(slug);
    const model = room.exhibits.find((exhibit) => exhibit.id === exhibitId)?.model;
    if (!model || (version && version !== model.checksumSha256)) throw new NotFoundException('Không tìm thấy mô hình công khai.');
    return this.storage.open(model.storageKey, model.sizeBytes, signal);
  }
}
