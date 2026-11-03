import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeletedQueryDto, withDeletedAt } from '../dto/deleted-filter.dto';
import { assertNothingBlocked } from '../exceptions/deletion-blocked';
import { ListUsersQueryDto } from '../../modules/users/dto/list-users-query.dto';

function parse<T extends object>(cls: new () => T, query: Record<string, unknown>) {
  const dto = plainToInstance(cls, query);
  return { dto, errors: validateSync(dto) };
}

describe('DeletedFilter — query ?deleted=', () => {
  for (const [raw, expected] of [['true', true], ['false', false], [undefined, undefined]] as const) {
    it(`${String(raw)} → ${String(expected)}`, () => {
      const { dto, errors } = parse(DeletedQueryDto, raw === undefined ? {} : { deleted: raw });
      assert.equal(errors.length, 0);
      assert.equal(dto.deleted, expected);
    });
  }

  for (const raw of ['yes', '1', '']) {
    it(`từ chối ${JSON.stringify(raw)} (không ép ngầm thành true)`, () => {
      const { errors } = parse(ListUsersQueryDto, { deleted: raw });
      assert.equal(errors[0]?.property, 'deleted');
      assert.deepEqual(Object.values(errors[0].constraints ?? {}), ['deleted phải là true hoặc false']);
    });
  }

  it('withDeletedAt chỉ thêm deletedAt khi xem thùng rác', () => {
    const at = new Date('2026-10-01T00:00:00Z');
    assert.deepEqual(withDeletedAt({ id: 'a' }, { deletedAt: at }, true), { id: 'a', deletedAt: at });
    assert.deepEqual(withDeletedAt({ id: 'a' }, { deletedAt: null }, false), { id: 'a' });
    assert.deepEqual(withDeletedAt({ id: 'a' }, { deletedAt: null }, undefined), { id: 'a' });
  });
});

describe('assertNothingBlocked — xóa & khôi phục', () => {
  const blocked = [{ id: 'x', reason: 'Lý do' }];

  it('khôi phục hàng loạt: 409 restore_blocked, thông điệp khôi phục', () => {
    assert.throws(() => assertNothingBlocked(blocked, false, 'restore'), (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.deepEqual(error.getResponse(), {
        message: 'Không khôi phục được 1 mục đã chọn. Không mục nào được khôi phục.',
        errors: [{ code: 'restore_blocked', field: 'x', message: 'Lý do' }],
      });
      return true;
    });
  });

  it('mặc định vẫn là xóa (giữ hành vi cũ)', () => {
    assert.throws(() => assertNothingBlocked(blocked, false), (error: unknown) => {
      const body = (error as ConflictException).getResponse() as { message: string; errors: Array<{ code: string }> };
      assert.equal(body.message, 'Không xóa được 1 mục đã chọn. Không mục nào bị xóa.');
      assert.equal(body.errors[0].code, 'delete_blocked');
      return true;
    });
    assert.throws(() => assertNothingBlocked([{ id: 'x', reason: 'Không có', notFound: true }], true), NotFoundException);
    assert.doesNotThrow(() => assertNothingBlocked([], false, 'restore'));
  });
});
