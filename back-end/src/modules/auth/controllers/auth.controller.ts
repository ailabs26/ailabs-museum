import {
  BadRequestException,
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
import { auditClientInfo } from '../../audit/audit-request.util';
import { AuditService } from '../../audit/services/audit.service';
import { LoginFailedException } from '../exceptions/login-failed.exception';
import { DisableTwoFactorDto, LoginTwoFactorDto, TwoFactorCodeDto } from '../dto/two-factor.dto';
import { TwoFactorService } from '../services/two-factor.service';
import { RefreshFailedException } from '../exceptions/refresh-failed.exception';
import { AuthService } from '../services/auth.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { WrongCurrentPasswordException } from '../exceptions/wrong-current-password.exception';
import { SessionResponse } from '../dto/session-response.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { RefreshCookieOriginGuard } from '../guards/refresh-cookie-origin.guard';
import { AuthRateLimiter, type AuthBlockKind } from '../services/auth-rate-limiter.service';
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
    private readonly audit: AuditService,
    private readonly twoFactor: TwoFactorService,
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
  ): Promise<{ accessToken: string; user: AuthUser } | { mfaRequired: true; mfaToken: string }> {
    const ip = req.ip ?? 'unknown';
    await this.limitWithAudit(req, res, 'auth.login_blocked', 'ip', ip, null, () => this.limiter.consumeIp(ip));
    await this.limitWithAudit(req, res, 'auth.login_blocked', 'email', dto.email, null,
      () => this.limiter.assertEmailAllowed(dto.email));

    let result;
    try {
      result = await this.auth.login(dto, this.clientOf(req));
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.limiter.recordEmailFailure(dto.email);
      }
      if (error instanceof LoginFailedException) {
        // Không ghi email đã nhập (dữ liệu do người ngoài gửi); tài khoản đích nằm ở resourceId nếu có.
        await this.recordAuthEvent(req, 'auth.login_failed', null, error.userId, { reason: error.reason });
      }
      throw error;
    }
    this.limiter.resetEmail(dto.email);
    if ('mfaRequired' in result) {
      // Đúng mật khẩu, tài khoản bật 2FA: chưa cấp phiên, chờ POST /auth/login/2fa.
      return { mfaRequired: true, mfaToken: result.mfaToken };
    }
    this.setRefreshCookie(res, result.refreshToken);
    await this.recordAuthEvent(req, 'auth.login', result.user.id, result.user.id);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bước 2 đăng nhập khi bật 2FA: mfaToken + mã 6 số (hoặc mã khôi phục)' })
  @ApiUnauthorizedResponse({ description: 'Mã sai, token hết hạn (5 phút) hoặc tài khoản bị khóa.' })
  @ApiTooManyRequestsResponse({ description: 'Sai mã quá 5 lần / 15 phút / tài khoản, hoặc quá nhiều request theo IP.' })
  @ApiOkResponse({ description: 'Như /auth/login thành công: access token + user; refresh token qua cookie HttpOnly.' })
  async loginTwoFactor(
    @Body() dto: LoginTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const ip = req.ip ?? 'unknown';
    await this.limitWithAudit(req, res, 'auth.login_blocked', 'ip', ip, null, () => this.limiter.consumeIp(ip));
    if (!dto.code === !dto.recoveryCode) {
      throw new BadRequestException('Nhập mã 6 số hoặc mã khôi phục (chỉ một trong hai)');
    }
    let result;
    try {
      result = await this.auth.loginTwoFactor(dto, this.clientOf(req));
    } catch (error) {
      if (error instanceof LoginFailedException) {
        await this.recordAuthEvent(req, 'auth.login_failed', null, error.userId, { reason: error.reason });
      } else if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const body = error.getResponse() as { retryAfter?: number };
        if (body.retryAfter) res.setHeader('Retry-After', String(body.retryAfter));
      }
      throw error;
    }
    this.setRefreshCookie(res, result.refreshToken);
    await this.recordAuthEvent(req, 'auth.login', result.user.id, result.user.id, { twoFactor: dto.code ? 'totp' : 'recovery_code' });
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
  @ApiTooManyRequestsResponse({
    description: 'Quá nhiều lần làm mới theo phiên, theo IP, hoặc với cookie sai; xem Retry-After.',
  })
  @ApiOkResponse({
    description: 'Access token mới trong ApiResponse và refresh cookie đã xoay vòng.',
  })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const ip = req.ip ?? 'unknown';
    const raw = this.readRefreshCookie(req);
    // Tách khỏi login (issue #126): trần rộng theo IP trước khi chạm DB, rồi đếm theo phiên; không có hoặc
    // sai cookie thì đếm chặt theo IP (chống dò token).
    await this.limitWithAudit(req, res, 'auth.refresh_blocked', 'refresh_ip', ip, null,
      () => this.limiter.consumeRefreshIp(ip));
    const owner = raw ? await this.tokens.findSessionOwner(raw) : null;
    if (owner) {
      await this.limitWithAudit(req, res, 'auth.refresh_blocked', 'refresh_session', owner.familyId, owner.userId,
        () => this.limiter.consumeRefreshSession(owner.familyId));
    } else {
      await this.limitWithAudit(req, res, 'auth.refresh_blocked', 'refresh_invalid', ip, null,
        () => this.limiter.consumeRefreshInvalid(ip));
    }
    try {
      const result = await this.auth.refresh(raw, this.clientOf(req));
      this.setRefreshCookie(res, result.refreshToken);
      return { accessToken: result.accessToken };
    } catch (error) {
      // Ân hạn: cookie trình duyệt đang giữ là token mới vừa cấp cho tab khác — xóa thì tab đó mất phiên.
      const rotatedRecently = error instanceof RefreshFailedException && error.reason === 'rotated_recently';
      if (error instanceof UnauthorizedException && !rotatedRecently) {
        this.clearRefreshCookie(res);
      }
      if (error instanceof RefreshFailedException && error.reason === 'reuse') {
        // Token đã xoay vòng bị gửi lại: cả family đã bị thu hồi, ghi vết để Admin điều tra.
        await this.recordAuthEvent(req, 'auth.refresh_reuse_detected', null, error.userId,
          { familyId: error.familyId });
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
    const userId = await this.auth.logout(this.readRefreshCookie(req));
    this.clearRefreshCookie(res);
    if (userId) await this.recordAuthEvent(req, 'auth.logout', userId, userId);
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

  /**
   * Kiểm giới hạn; bị chặn thì ghi audit `action` (1 lần mỗi cửa sổ cho mỗi khóa) rồi ném 429.
   * `reason.limit`: ip | email (login), ip | session | invalid (refresh).
   */
  private async limitWithAudit(
    req: Request, res: Response, action: 'auth.login_blocked' | 'auth.refresh_blocked',
    kind: AuthBlockKind, value: string, resourceId: string | null, check: () => void,
  ): Promise<void> {
    try {
      this.limitOrRetryAfter(res, check);
    } catch (error) {
      if (this.limiter.shouldAuditBlock(kind, value)) {
        await this.recordAuthEvent(req, action, null, resourceId, { limit: kind.replace(/^refresh_/, '') });
      }
      throw error;
    }
  }

  /** Audit sự kiện xác thực kèm IP/User-Agent; lỗi ghi không làm hỏng đăng nhập/đăng xuất. */
  private recordAuthEvent(
    req: Request, action: string, actorId: string | null, resourceId: string | null, details?: object,
  ): Promise<void> {
    const client = auditClientInfo(req);
    return this.audit.recordSafely({
      actorId, action, resourceType: 'user', resourceId,
      reason: details ? JSON.stringify(details) : null,
      requestId: client.requestId, ip: client.ip, userAgent: client.userAgent,
    });
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

  @Get('2fa')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trạng thái 2FA của tôi (đang bật, số mã khôi phục còn lại)' })
  twoFactorStatus(@CurrentUser() user: AuthUser) {
    return this.twoFactor.status(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bắt đầu bật 2FA: secret mới + QR cho app Authenticator (chưa có hiệu lực tới khi xác nhận)' })
  twoFactorSetup(@CurrentUser() user: AuthUser) {
    return this.twoFactor.setup(user);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.2fa_enable', 'user')
  @ApiOperation({ summary: 'Xác nhận mã đầu tiên → bật 2FA; trả 10 mã khôi phục (chỉ hiện một lần); đăng xuất thiết bị khác' })
  async twoFactorEnable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return { id: user.id, ...(await this.twoFactor.enable(user, dto.code)) };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.2fa_disable', 'user')
  @ApiOperation({ summary: 'Tắt 2FA: mật khẩu hiện tại + mã 6 số hoặc mã khôi phục; đăng xuất thiết bị khác' })
  @ApiTooManyRequestsResponse({ description: 'Nhập sai mật khẩu hiện tại quá nhiều lần; xem Retry-After.' })
  async twoFactorDisable(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTwoFactorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string }> {
    if (!dto.code === !dto.recoveryCode) {
      throw new BadRequestException('Nhập mã 6 số hoặc mã khôi phục (chỉ một trong hai)');
    }
    // Sai mật khẩu tính chung bộ đếm với đăng nhập sai theo email; sai mã tính bộ đếm 2FA của tài khoản.
    this.limitOrRetryAfter(res, () => this.limiter.assertEmailAllowed(user.email));
    this.limitOrRetryAfter(res, () => this.limiter.assertMfaAllowed(user.id));
    try {
      await this.twoFactor.disable(user, dto.password, { code: dto.code, recoveryCode: dto.recoveryCode });
    } catch (error) {
      if (error instanceof WrongCurrentPasswordException) this.limiter.recordEmailFailure(user.email);
      else if (error instanceof BadRequestException) this.limiter.recordMfaFailure(user.id);
      throw error;
    }
    this.limiter.resetMfa(user.id);
    return { id: user.id };
  }

  @Post('2fa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth.2fa_recovery_regenerate', 'user')
  @ApiOperation({ summary: 'Tạo 10 mã khôi phục mới (bộ cũ hết hiệu lực); cần mã 6 số hiện tại' })
  async twoFactorRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.limitOrRetryAfter(res, () => this.limiter.assertMfaAllowed(user.id));
    try {
      return { id: user.id, ...(await this.twoFactor.regenerateRecoveryCodes(user, dto.code)) };
    } catch (error) {
      if (error instanceof BadRequestException) this.limiter.recordMfaFailure(user.id);
      throw error;
    }
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
