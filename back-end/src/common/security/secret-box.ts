import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Mã hóa đối xứng giá trị bí mật lưu trong DB (vd secret TOTP) bằng AES-256-GCM. Khóa AES dẫn xuất bằng SHA-256 từ
 * chuỗi cấu hình. Định dạng: `v1.<iv>.<tag>.<ciphertext>` (base64url); `tag` phát hiện dữ liệu bị sửa hoặc sai khóa.
 */
const VERSION = 'v1';

function keyOf(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function sealSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

/** Giải mã; ném lỗi nếu sai định dạng, sai khóa hoặc bị sửa. */
export function openSecret(sealed: string, secret: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Giá trị mã hóa không hợp lệ');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
