import { BadRequestException } from '@nestjs/common';
import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Chính sách độ mạnh mật khẩu (hướng NIST SP 800-63B): ưu tiên độ dài và chặn mật khẩu dễ đoán,
 * không ép ký tự đặc biệt, không bắt đổi định kỳ. Chỉ áp dụng khi ĐẶT mật khẩu mới.
 */
export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt chỉ dùng 72 byte đầu — dài hơn thì phần dư bị bỏ qua âm thầm, nên từ chối. */
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordContext {
  email?: string | null;
  displayName?: string | null;
}

export interface PasswordPolicyError {
  code: 'password_too_short' | 'password_too_long' | 'password_needs_letter_and_digit' | 'password_common' | 'password_personal';
  message: string;
}

/**
 * Từ gốc hay gặp trong mật khẩu yếu; mật khẩu mà bỏ hết số/ký tự chỉ còn một trong các từ này (vd "Password2024!",
 * "matkhau123456") bị coi là phổ biến.
 */
const COMMON_WORDS = new Set([
  'password', 'passw', 'passwd', 'pass', 'admin', 'administrator', 'root', 'user', 'login', 'welcome', 'qwerty',
  'qwertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh',
  'iloveyou', 'letmein', 'monkey', 'dragon', 'master', 'secret', 'sunshine', 'princess', 'football', 'baseball',
  'superman', 'batman', 'trustno', 'changeme', 'default', 'test', 'testing', 'guest', 'hello', 'freedom', 'whatever',
  'matkhau', 'mk', 'anhyeuem', 'emyeuanh', 'yeuem', 'iloveu', 'vietnam', 'hanoi', 'saigon', 'baotang', 'aura',
  'auramuseum', 'museum', 'cms', 'qw', 'qwe', 'qwer', 'qwert',
]);

/** Chuỗi bàn phím / dãy hay gặp, so nguyên chuỗi (lowercase). */
const COMMON_EXACT = new Set([
  '1q2w3e4r5t', '1q2w3e4r5t6y', '1qaz2wsx3edc', '1qaz2wsx', 'zaq12wsx', 'zaq1zaq1', 'qazwsx123', 'qwe123qwe123',
  'q1w2e3r4t5', 'q1w2e3r4t5y6', 'a1b2c3d4e5', 'a1b2c3d4e5f6', 'abc123abc123', 'abcd1234abcd', '1234qwer', '1234qwerasdf',
  'qwer1234qwer', 'asdf1234asdf', 'pass1234word',
]);

/** Bỏ dấu tiếng Việt, đ → d, lowercase — để "Thắng" khớp "thang" trong mật khẩu. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/** Phần riêng của người dùng (≥ 3 ký tự) không được xuất hiện trong mật khẩu. */
function personalTokens(context: PasswordContext): string[] {
  const tokens = [context.email?.split('@')[0] ?? '', ...(context.displayName ?? '').split(/\s+/)];
  return tokens.map((token) => fold(token).replace(/[^\p{L}\p{N}]/gu, '')).filter((token) => token.length >= 3);
}

/** Danh sách vi phạm (rỗng = hợp lệ). */
export function checkPasswordPolicy(password: string, context: PasswordContext = {}): PasswordPolicyError[] {
  const errors: PasswordPolicyError[] = [];
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    errors.push({ code: 'password_too_short', message: `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự` });
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    errors.push({ code: 'password_too_long', message: `Mật khẩu quá dài (tối đa ${PASSWORD_MAX_BYTES} byte, khoảng ${PASSWORD_MAX_BYTES} ký tự không dấu)` });
  }
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    errors.push({ code: 'password_needs_letter_and_digit', message: 'Mật khẩu phải có cả chữ và số' });
  }

  const lower = fold(password);
  const letters = lower.replace(/[^\p{L}]/gu, '');
  // Phần chữ chỉ là một ký tự lặp lại (vd "aaaaaaaaaa1", "x123456789") cũng là mật khẩu yếu.
  if (COMMON_EXACT.has(lower) || COMMON_WORDS.has(letters) || /^(.)\1*$/u.test(letters) || /^(.)\1+$/u.test(lower)) {
    errors.push({ code: 'password_common', message: 'Mật khẩu quá phổ biến, dễ bị đoán' });
  }

  const alnum = lower.replace(/[^\p{L}\p{N}]/gu, '');
  if (personalTokens(context).some((token) => alnum.includes(token))) {
    errors.push({ code: 'password_personal', message: 'Mật khẩu không được chứa email hoặc tên của bạn' });
  }
  return errors;
}

/** Dùng trong service khi ngữ cảnh (email/tên) lấy từ user đã có: ném 400 theo định dạng `errors[]` chuẩn. */
export function assertPasswordPolicy(password: string, context: PasswordContext, field = 'password'): void {
  const errors = checkPasswordPolicy(password, context);
  if (errors.length > 0) {
    throw new BadRequestException({
      message: errors[0].message,
      errors: errors.map((error) => ({ code: error.code, field, message: error.message })),
    });
  }
}

/**
 * Decorator cho DTO: áp toàn bộ chính sách; nếu chính DTO có `email`/`displayName` (vd tạo user) thì kiểm luôn việc
 * chứa thông tin cá nhân. Thông báo lỗi là vi phạm đầu tiên.
 */
export function IsStrongPassword(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isStrongPassword',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const object = args.object as PasswordContext;
          return checkPasswordPolicy(value, { email: object.email, displayName: object.displayName }).length === 0;
        },
        defaultMessage(args: ValidationArguments) {
          if (typeof args.value !== 'string') return 'Mật khẩu không hợp lệ';
          const object = args.object as PasswordContext;
          return checkPasswordPolicy(args.value, { email: object.email, displayName: object.displayName })[0]?.message
            ?? 'Mật khẩu không hợp lệ';
        },
      },
    });
  };
}
