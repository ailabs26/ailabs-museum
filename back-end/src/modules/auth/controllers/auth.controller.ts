import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthUser } from '../../../common/types/auth-user.type';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { TokenService } from '../services/token.service';

type RequestWithCookies = Request & { cookies?: Record<string, string> };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập, trả access token + set cookie refresh' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới access token bằng refresh cookie (xoay vòng)' })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.auth.refresh(this.readRefreshCookie(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất: thu hồi refresh session và xóa cookie' })
  async logout(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    await this.auth.logout(this.readRefreshCookie(req));
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Thông tin phiên hiện tại (roles + permissions)' })
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }

  private cookieName(): string {
    return this.config.getOrThrow<string>('jwt.refreshCookieName');
  }

  private readRefreshCookie(req: RequestWithCookies): string | undefined {
    return req.cookies?.[this.cookieName()];
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.tokens.refreshCookieMaxAgeMs(),
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cookieName(), { path: '/' });
  }
}
