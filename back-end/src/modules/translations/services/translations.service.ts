import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeValues } from '../constants/locales';
import { CreateTranslationDto } from '../dto/create-translation.dto';
import { UpdateTranslationValuesDto } from '../dto/update-translation-values.dto';
import { TranslationResponse, toTranslationResponse } from '../dto/translation-response.dto';
import { Translation } from '../entities/translation.entity';
import { TranslationsRepository } from '../repositories/translations.repository';

@Injectable()
export class TranslationsService {
  constructor(private readonly translations: TranslationsRepository) {}

  async list(): Promise<TranslationResponse[]> {
    return (await this.translations.listAll()).map(toTranslationResponse);
  }

  async create(dto: CreateTranslationDto): Promise<TranslationResponse> {
    if (await this.translations.findByNamespace(dto.namespace)) {
      throw new ConflictException('Namespace đã tồn tại');
    }
    const entity = this.translations.create({
      namespace: dto.namespace,
      context: dto.context?.trim() ?? '',
      category: dto.category,
      values: sanitizeValues(dto.values),
    });
    const saved = (await this.translations.save(entity)) as Translation;
    return toTranslationResponse(saved);
  }

  async updateValues(id: string, dto: UpdateTranslationValuesDto): Promise<TranslationResponse> {
    const entity = await this.requireById(id);
    entity.values = { ...entity.values, ...sanitizeValues(dto.values) };
    const saved = (await this.translations.save(entity)) as Translation;
    return toTranslationResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.requireById(id);
    await this.translations.remove(entity);
  }

  private async requireById(id: string): Promise<Translation> {
    const entity = await this.translations.findById(id);
    if (!entity) throw new NotFoundException('Không tìm thấy mục bản dịch');
    return entity;
  }
}
