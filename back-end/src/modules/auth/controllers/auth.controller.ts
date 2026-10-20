import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập, trả access token + set cookie refresh' })
  @ApiUnauthorizedResponse({ description: 'Sai thông tin đăng nhập hoặc tài khoản bị khóa.' })
  @ApiOkResponse({
    description: 'Access token và user trong ApiResponse; refresh token qua cookie HttpOnly.',
  })
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
  @UseGuards(RefreshCookieOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token bằng refresh cookie (xoay vòng)' })
  @ApiUnauthorizedResponse({
    description: 'Cookie bị xóa khi phiên không hợp lệ, hết hạn hoặc bị tái sử dụng.',
  })
  @ApiOkResponse({
    description: 'Access token mới trong ApiResponse và refresh cookie đã xoay vòng.',
  })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    try {
      const result = await this.auth.refresh(this.readRefreshCookie(req));
      this.setRefreshCookie(res, result.refreshToken);
      return { accessToken: result.accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.clearRefreshCookie(res);
      }
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @UseGuards(RefreshCookieOriginGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất: thu hồi refresh session và xóa cookie' })
  @ApiOkResponse({
    description: 'Không cần access token còn hạn. Thu hồi refresh session nếu có và xóa cookie; có thể gọi lại.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'object', nullable: true, example: null },
        message: { type: 'string', nullable: true, example: null },
      },
    },
  })
  async logout(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.auth.logout(this.readRefreshCookie(req));
    this.clearRefreshCookie(res);
    return null;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin phiên hiện tại (roles + permissions)' })
  @ApiOkResponse({ description: 'User hiện tại trong ApiResponse.' })
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
      ...this.refreshCookieOptions(),
      maxAge: this.tokens.refreshCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cookieName(), this.refreshCookieOptions());
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
  }
}
