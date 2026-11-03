/**
 * Bản phía FE của chính sách mật khẩu (back-end/src/common/security/password-policy.ts) để báo ngay khi gõ.
 * Back-end là chốt chặn thật: danh sách mật khẩu phổ biến chỉ kiểm ở back-end và trả về qua `errors[]`.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordContext {
  email?: string | null;
  displayName?: string | null;
}

export interface PasswordRule {
  id: 'length' | 'bytes' | 'letterDigit' | 'personal';
  label: string;
  ok: boolean;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

function containsPersonal(password: string, context: PasswordContext): boolean {
  const tokens = [context.email?.split('@')[0] ?? '', ...(context.displayName ?? '').split(/\s+/)]
    .map((token) => fold(token).replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((token) => token.length >= 3);
  const alnum = fold(password).replace(/[^\p{L}\p{N}]/gu, '');
  return tokens.some((token) => alnum.includes(token));
}

export function passwordRules(password: string, context: PasswordContext = {}): PasswordRule[] {
  return [
    { id: 'length', label: `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`, ok: [...password].length >= PASSWORD_MIN_LENGTH },
    { id: 'bytes', label: 'Không quá 72 byte (khoảng 72 ký tự không dấu)', ok: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES },
    { id: 'letterDigit', label: 'Có cả chữ và số', ok: /\p{L}/u.test(password) && /\p{N}/u.test(password) },
    { id: 'personal', label: 'Không chứa email hoặc tên', ok: !containsPersonal(password, context) },
  ];
}

/** Lỗi đầu tiên cho form (null = đạt các quy tắc phía FE). */
export function passwordError(password: string, context: PasswordContext = {}): string | null {
  const failed = passwordRules(password, context).find((rule) => !rule.ok);
  if (!failed) return null;
  return {
    length: `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`,
    bytes: `Mật khẩu quá dài (tối đa ${PASSWORD_MAX_BYTES} byte)`,
    letterDigit: 'Mật khẩu phải có cả chữ và số',
    personal: 'Mật khẩu không được chứa email hoặc tên',
  }[failed.id];
}

/** Điểm 0–100 cho thanh đo: đạt quy tắc + thưởng độ dài và độ đa dạng ký tự. */
export function passwordScore(password: string, context: PasswordContext = {}): number {
  if (!password) return 0;
  const rules = passwordRules(password, context);
  if (rules.some((rule) => !rule.ok)) return Math.min(30, [...password].length * 3);
  const length = [...password].length;
  const variety = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((re) => re.test(password)).length;
  return Math.min(100, 40 + (length - PASSWORD_MIN_LENGTH) * 4 + variety * 8);
}
