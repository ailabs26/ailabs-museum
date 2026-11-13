import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

/**
 * Hash & so khớp mật khẩu bằng bcrypt. Hạ tầng global (CoreModule) để Auth,
 * Users và script seed dùng chung mà không tạo phụ thuộc vòng giữa các module.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.getDummyHash();
  }

  hash(plain: string): Promise<string> {
    const rounds = this.config.getOrThrow<number>('jwt.bcryptRounds');
    return bcrypt.hash(plain, rounds);
  }

  async compare(plain: string, hash?: string): Promise<boolean> {
    // User không tồn tại vẫn thực hiện bcrypt với cùng cost factor.
    return bcrypt.compare(plain, hash ?? await this.getDummyHash());
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }
}
