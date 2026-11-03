import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';
import { assertPasswordPolicy, checkPasswordPolicy, PASSWORD_MAX_BYTES } from '../security/password-policy';

const codes = (password: string, context = {}) => checkPasswordPolicy(password, context).map((e) => e.code);

describe('checkPasswordPolicy', () => {
  it('mật khẩu tốt (dài, chữ + số, không phổ biến, không chứa thông tin cá nhân) → hợp lệ, không ép ký tự đặc biệt', () => {
    for (const ok of ['tramhuong7bienxanh', 'Gom su Bat Trang 1450', 'Đồngthau-trống-1924', 'k9vB2mQx7pLw']) {
      assert.deepEqual(codes(ok), [], ok);
    }
  });

  it('độ dài tính theo ký tự (không theo byte): 9 ký tự → ngắn; 10 → đủ; chữ có dấu tính 1 ký tự', () => {
    assert.deepEqual(codes('hoangth12'), ['password_too_short']);
    assert.deepEqual(codes('hoangthu12'), []);
    assert.deepEqual(codes('đồngđồng12'), []); // 10 ký tự, 16 byte
  });

  it('giới hạn 72 byte của bcrypt: 72 byte được, 73 byte bị từ chối; chữ có dấu chiếm nhiều byte', () => {
    assert.deepEqual(codes(`a1${'x'.repeat(PASSWORD_MAX_BYTES - 2)}`), []);
    assert.deepEqual(codes(`a1${'x'.repeat(PASSWORD_MAX_BYTES - 1)}`), ['password_too_long']);
    // 'ệ' = 3 byte: 25 lần = 75 byte dù chỉ 26 ký tự
    assert.ok(codes(`1${'ệ'.repeat(25)}`).includes('password_too_long'));
  });

  it('thiếu chữ hoặc thiếu số → từ chối', () => {
    assert.ok(codes('chicochuthoi').includes('password_needs_letter_and_digit'));
    assert.ok(codes('83920175648').includes('password_needs_letter_and_digit'));
  });

  it('mật khẩu phổ biến và biến thể thêm số/ký tự → từ chối', () => {
    for (const weak of ['Password2024!', 'password123456', 'Matkhau123456', 'admin@123456', 'Qwerty123456', '1q2w3e4r5t',
      'a1234567890', 'aaaaaaaaaa1', 'Anhyeuem12345', 'Baotang2026!']) {
      assert.ok(codes(weak).includes('password_common'), weak);
    }
    assert.ok(codes('1111111111').includes('password_common'));
  });

  it('chứa phần trước @ của email hoặc một từ trong tên (bỏ dấu, không phân biệt hoa thường) → từ chối', () => {
    const context = { email: 'thang.nguyen@aura.local', displayName: 'Nguyễn Văn Thắng' };
    assert.ok(codes('xyz-THANGNGUYEN-77', context).includes('password_personal'));
    assert.ok(codes('xyz-thang-hoa-77', context).includes('password_personal'));
    assert.ok(codes('NGUYEN-hoa-binh-7', context).includes('password_personal'));
    assert.deepEqual(codes('hoa-binh-sen-7x', context), []);
    // Từ < 3 ký tự không xét (tránh chặn oan)
    assert.deepEqual(codes('lamviec-ab-7x9', { displayName: 'Ab' }), []);
  });

  it('assertPasswordPolicy ném 400 với errors[] chuẩn (code, field, message)', () => {
    assert.throws(() => assertPasswordPolicy('short1', {}, 'newPassword'), (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = error.getResponse() as { errors: { code: string; field: string }[] };
      assert.deepEqual(body.errors.map((e) => [e.code, e.field]), [['password_too_short', 'newPassword']]);
      return true;
    });
  });
});

describe('@IsStrongPassword trên CreateUserDto', () => {
  const dto = (password: string) => plainToInstance(CreateUserDto, { email: 'lan.tran@aura.local', password, displayName: 'Trần Thị Lan' });

  it('dùng email/tên của chính DTO để chặn mật khẩu chứa thông tin cá nhân; thông báo là vi phạm đầu tiên', async () => {
    const [personal] = await validate(dto('lantran-hoasen-7'));
    assert.equal(personal.property, 'password');
    assert.match(Object.values(personal.constraints ?? {})[0], /email hoặc tên/);

    const [short] = await validate(dto('abc12'));
    assert.match(Object.values(short.constraints ?? {})[0], /tối thiểu 10 ký tự/);

    assert.deepEqual(await validate(dto('hoasen-ven-ho-7')), []);
  });
});
