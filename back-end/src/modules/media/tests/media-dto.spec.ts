import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import { toMediaResponse } from '../dto/media-response.dto';
import { MEDIA_TEXT_LIMITS, UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';

/** Cùng cấu hình ValidationPipe toàn cục trong main.ts. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

async function run<T>(metatype: new () => T, value: unknown, type: ArgumentMetadata['type'] = 'body'): Promise<T> {
  return (await pipe.transform(value, { type, metatype })) as T;
}

async function expectInvalid(metatype: new () => unknown, value: unknown, pattern: RegExp, type: ArgumentMetadata['type'] = 'body') {
  await assert.rejects(run(metatype, value, type), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    const messages = (error.getResponse() as { message: string[] }).message;
    assert.ok(messages.some((message) => pattern.test(message)), `không có lỗi khớp ${pattern}: ${messages.join(' | ')}`);
    return true;
  });
}

describe('UploadMediaDto (field text của multipart)', () => {
  it('body rỗng hợp lệ — mọi trường đều tùy chọn', async () => {
    const dto = await run(UploadMediaDto, {});
    assert.equal(dto.kind, undefined);
  });

  for (const kind of Object.values(MediaKind)) {
    it(`kind="${kind}" hợp lệ`, async () => {
      assert.equal((await run(UploadMediaDto, { kind })).kind, kind);
    });
  }

  it('kind không hợp lệ ("video") → 400', () => expectInvalid(UploadMediaDto, { kind: 'video' }, /kind phải là/));
  it('kind "svg" → 400', () => expectInvalid(UploadMediaDto, { kind: 'svg' }, /kind phải là/));

  it('trim khoảng trắng metadata', async () => {
    const dto = await run(UploadMediaDto, { source: '  Bảo tàng Lịch sử  ', author: '\tNguyễn Văn A\n', license: ' CC BY 4.0 ' });
    assert.equal(dto.source, 'Bảo tàng Lịch sử');
    assert.equal(dto.author, 'Nguyễn Văn A');
    assert.equal(dto.license, 'CC BY 4.0');
  });

  it('chuỗi rỗng / chỉ khoảng trắng → null', async () => {
    const dto = await run(UploadMediaDto, { source: '', author: '   ', altText: '' });
    assert.equal(dto.source, null);
    assert.equal(dto.author, null);
    assert.equal(dto.altText, null);
  });

  it('KHÔNG nhận trường "url" tùy ý (chống bypass pipeline upload) → 400', () =>
    expectInvalid(UploadMediaDto, { url: 'https://evil.example/x.glb' }, /url should not exist/));
  it('KHÔNG nhận "storageKey" → 400', () => expectInvalid(UploadMediaDto, { storageKey: '../../etc/passwd' }, /storageKey should not exist/));
  it('KHÔNG nhận "mimeType" do client khai báo → 400', () => expectInvalid(UploadMediaDto, { mimeType: 'image/png' }, /mimeType should not exist/));
  it('KHÔNG nhận "processingState" → 400', () => expectInvalid(UploadMediaDto, { processingState: 'ready' }, /processingState should not exist/));
  it('KHÔNG nhận "createdById" → 400', () => expectInvalid(UploadMediaDto, { createdById: 'x' }, /createdById should not exist/));
});

describe('UpdateMediaDto', () => {
  it('cập nhật đủ 4 trường hợp lệ', async () => {
    const dto = await run(UpdateMediaDto, { altText: 'Trống đồng', source: 'Kho lưu trữ', author: 'A', license: 'CC0' });
    assert.deepEqual({ ...dto }, { altText: 'Trống đồng', source: 'Kho lưu trữ', author: 'A', license: 'CC0' });
  });

  it('null được giữ nguyên để xóa giá trị', async () => {
    const dto = await run(UpdateMediaDto, { source: null, license: null });
    assert.equal(dto.source, null);
    assert.equal(dto.license, null);
  });

  it('trường không gửi giữ undefined (không thay đổi)', async () => {
    const dto = await run(UpdateMediaDto, { author: 'B' });
    assert.equal(dto.source, undefined);
    assert.equal(dto.author, 'B');
  });

  for (const [field, limit] of Object.entries(MEDIA_TEXT_LIMITS)) {
    it(`${field}: đúng ${limit} ký tự hợp lệ`, async () => {
      const dto = await run(UpdateMediaDto, { [field]: 'a'.repeat(limit) });
      assert.equal((dto as unknown as Record<string, string>)[field].length, limit);
    });

    it(`${field}: ${limit + 1} ký tự → 400`, () =>
      expectInvalid(UpdateMediaDto, { [field]: 'a'.repeat(limit + 1) }, new RegExp(`${field} không được vượt quá ${limit}`)));

    it(`${field}: số thay vì chuỗi → 400`, () => expectInvalid(UpdateMediaDto, { [field]: 123 }, new RegExp(`${field} phải là chuỗi`)));

    it(`${field}: mảng → 400`, () => expectInvalid(UpdateMediaDto, { [field]: ['a'] }, new RegExp(`${field} phải là chuỗi`)));
  }

  it('giới hạn tính sau khi trim: 240 ký tự + khoảng trắng hai đầu hợp lệ', async () => {
    const dto = await run(UpdateMediaDto, { altText: `  ${'b'.repeat(240)}  ` });
    assert.equal(dto.altText?.length, 240);
  });

  it('không nhận "kind" khi cập nhật (không đổi loại media) → 400', () => expectInvalid(UpdateMediaDto, { kind: 'image' }, /kind should not exist/));
  it('không nhận "url" → 400', () => expectInvalid(UpdateMediaDto, { url: '/media/x.png' }, /url should not exist/));
  it('không nhận "sizeBytes" → 400', () => expectInvalid(UpdateMediaDto, { sizeBytes: 1 }, /sizeBytes should not exist/));
});

describe('ListMediaQueryDto', () => {
  it('mặc định page=1, pageSize=20', async () => {
    const dto = await run(ListMediaQueryDto, {}, 'query');
    assert.equal(dto.page, 1);
    assert.equal(dto.pageSize, 20);
  });

  it('chuyển page/pageSize từ chuỗi query', async () => {
    const dto = await run(ListMediaQueryDto, { page: '3', pageSize: '50' }, 'query');
    assert.equal(dto.page, 3);
    assert.equal(dto.pageSize, 50);
  });

  it('lọc kind hợp lệ', async () => assert.equal((await run(ListMediaQueryDto, { kind: 'audio' }, 'query')).kind, MediaKind.AUDIO));
  it('lọc state=quarantined hợp lệ', async () =>
    assert.equal((await run(ListMediaQueryDto, { state: 'quarantined' }, 'query')).state, MediaProcessingState.QUARANTINED));
  it('kind không hợp lệ → 400', () => expectInvalid(ListMediaQueryDto, { kind: 'pdf' }, /kind phải là/, 'query'));
  it('state không hợp lệ → 400', () => expectInvalid(ListMediaQueryDto, { state: 'deleted' }, /state phải là/, 'query'));
  it('pageSize > 100 → 400', () => expectInvalid(ListMediaQueryDto, { pageSize: '101' }, /pageSize/, 'query'));
  it('page = 0 → 400', () => expectInvalid(ListMediaQueryDto, { page: '0' }, /page/, 'query'));
  it('tham số lạ → 400', () => expectInvalid(ListMediaQueryDto, { isDeleted: 'true' }, /isDeleted should not exist/, 'query'));
});

describe('toMediaResponse', () => {
  const media = Object.assign(new Media(), {
    id: 'a1111111-1111-4111-8111-111111111111',
    kind: MediaKind.IMAGE,
    storageKey: 'uploads/images/a.png',
    mimeType: 'image/png',
    sizeBytes: '2000000',
    checksumSha256: 'f'.repeat(64),
    processingState: MediaProcessingState.READY,
    originalName: 'trong-dong.png',
    altText: null,
    source: 'Kho',
    author: 'A',
    license: 'CC0',
    createdById: 'u1111111-1111-4111-8111-111111111111',
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-10-14T03:00:00.000Z'),
  });

  it('chuyển sizeBytes bigint (chuỗi) sang number', () => {
    assert.equal(toMediaResponse(media, '/media/x').sizeBytes, 2_000_000);
  });

  it('gắn url truyền vào', () => {
    assert.equal(toMediaResponse(media, '/media/uploads/images/a.png').url, '/media/uploads/images/a.png');
    assert.equal(toMediaResponse(media, null).url, null);
  });

  it('không lộ storageKey, isDeleted, deletedAt', () => {
    const response = toMediaResponse(media, null) as unknown as Record<string, unknown>;
    assert.equal('storageKey' in response, false);
    assert.equal('isDeleted' in response, false);
    assert.equal('deletedAt' in response, false);
  });

  it('giữ đầy đủ metadata quyền sử dụng (FR-97)', () => {
    const response = toMediaResponse(media, null);
    assert.equal(response.source, 'Kho');
    assert.equal(response.author, 'A');
    assert.equal(response.license, 'CC0');
    assert.equal(response.originalName, 'trong-dong.png');
  });

  it('trường thiếu (undefined) trả về null', () => {
    const partial = Object.assign(new Media(), { ...media, author: undefined, originalName: undefined }) as Media;
    const response = toMediaResponse(partial, null);
    assert.equal(response.author, null);
    assert.equal(response.originalName, null);
  });
});
