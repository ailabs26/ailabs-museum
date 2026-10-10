import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

/**
 * Hash & so khớp mật khẩu bằng bcrypt. Hạ tầng global (CoreModule) để Auth,
 * Users và script seed dùng chung mà không tạo phụ thuộc vòng giữa các module.
 */
@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService) {}

  hash(plain: string): Promise<string> {
    const rounds = this.config.getOrThrow<number>('BCRYPT_ROUNDS');
    return bcrypt.hash(plain, rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
