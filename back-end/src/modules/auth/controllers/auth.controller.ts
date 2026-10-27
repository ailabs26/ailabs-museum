import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
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
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuthService } from '../services/auth.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { SessionResponse } from '../dto/session-response.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter } from '../services/auth-rate-limiter.service';
import { SessionsService } from '../services/sessions.service';
import type { SessionClient } from '../services/token.service';
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
    private readonly sessions: SessionsService,
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
      result = await this.auth.login(dto, this.clientOf(req));
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
      const result = await this.auth.refresh(this.readRefreshCookie(req), this.clientOf(req));
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

  @Patch('me')
  @ApiBearerAuth()
  @Audit('auth.profile_update', 'user')
  @ApiOperation({ summary: 'Tự sửa hồ sơ (tên hiển thị) của tài khoản đang đăng nhập' })
  @ApiOkResponse({ description: 'AuthUser sau khi cập nhật.' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<AuthUser> {
    return this.auth.updateProfile(user.id, dto);
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

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.password_change', 'user')
  @ApiOperation({ summary: 'Tự đổi mật khẩu; đăng xuất mọi thiết bị khác, giữ thiết bị hiện tại' })
  @ApiOkResponse({ description: '`id` là người dùng vừa đổi mật khẩu (dùng cho audit).' })
  @ApiTooManyRequestsResponse({ description: 'Nhập sai mật khẩu hiện tại quá nhiều lần; xem Retry-After.' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string }> {
    // Sai mật khẩu hiện tại tính chung bộ đếm với đăng nhập sai theo email (chống dò mật khẩu).
    this.limitOrRetryAfter(res, () => this.limiter.assertEmailAllowed(user.email));
    try {
      await this.auth.changePassword(user, dto);
    } catch (error) {
      if (error instanceof WrongCurrentPasswordException) this.limiter.recordEmailFailure(user.email);
      throw error;
    }
    this.limiter.resetEmail(user.email);
    return { id: user.id };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Các thiết bị đang đăng nhập của chính mình' })
  @ApiOkResponse({ type: SessionResponse, isArray: true })
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionResponse[]> {
    return this.sessions.list(user);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @Audit('auth.session_revoke', 'session')
  @ApiOperation({ summary: 'Đăng xuất một thiết bị của chính mình (có hiệu lực ngay)' })
  @ApiNotFoundResponse({ description: 'Không có phiên này trong các phiên của bạn.' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    if (await this.sessions.revoke(user, id)) this.clearRefreshCookie(res);
    return null;
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.session_revoke_others', 'user')
  @ApiOperation({ summary: 'Đăng xuất mọi thiết bị khác, giữ thiết bị hiện tại' })
  @ApiOkResponse({ description: '`id` là người dùng vừa bị đăng xuất các thiết bị khác (dùng cho audit).' })
  async revokeOtherSessions(@CurrentUser() user: AuthUser): Promise<{ id: string }> {
    await this.sessions.revokeOthers(user);
    return { id: user.id };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.logout_all', 'user')
  @ApiOperation({ summary: 'Đăng xuất khỏi tất cả thiết bị, kể cả thiết bị hiện tại' })
  @ApiOkResponse({ description: '`id` là người dùng vừa bị đăng xuất (dùng cho audit). Cookie refresh bị xóa.' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string }> {
    await this.sessions.revokeAll(user);
    this.clearRefreshCookie(res);
    return { id: user.id };
  }

  private clientOf(req: Request): SessionClient {
    return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
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
