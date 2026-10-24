import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { TokenService } from '../services/token.service';

type RequestWithCookies = Request & { cookies?: Record<string, string> };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly limiter: AuthRateLimiter,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập, trả access token + set cookie refresh' })
  @ApiUnauthorizedResponse({ description: 'Sai thông tin đăng nhập hoặc tài khoản bị khóa.' })
  @ApiTooManyRequestsResponse({ description: 'Quá nhiều lần thử theo IP hoặc email; xem Retry-After.' })
  @ApiOkResponse({
    description: 'Access token và user trong ApiResponse; refresh token qua cookie HttpOnly.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    this.limitOrRetryAfter(res, () => {
      this.limiter.consumeIp(req.ip ?? 'unknown');
      this.limiter.assertEmailAllowed(dto.email);
    });

    let result;
    try {
      result = await this.auth.login(dto);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.limiter.recordEmailFailure(dto.email);
      }
      throw error;
    }
    this.limiter.resetEmail(dto.email);
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
    this.limitOrRetryAfter(res, () => this.limiter.consumeIp(req.ip ?? 'unknown'));
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

  /** Chạy kiểm tra giới hạn; nếu 429 thì gắn header Retry-After rồi ném lại. */
  private limitOrRetryAfter(res: Response, check: () => void): void {
    try {
      check();
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const body = error.getResponse() as { retryAfter?: number };
        if (body.retryAfter) res.setHeader('Retry-After', String(body.retryAfter));
      }
      throw error;
    }
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
