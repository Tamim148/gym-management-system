import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  LoginDto,
  LoginSchema,
  RegisterDto,
  RegisterSchema,
  RequestAuthContext,
  VerifyOtpDto,
  VerifyOtpSchema,
} from '@vintage/shared';
import { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public } from './auth.decorators';
import { AuthService, IssuedAuthCookies } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = req.ip || 'unknown';
    const { session, cookies } = await this.authService.login(dto, clientIp);
    this.setAuthCookies(res, cookies);
    return session;
  }

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, cookies } = await this.authService.register(dto);
    this.setAuthCookies(res, cookies);
    return session;
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefresh = req.cookies?.va_refresh_token as string | undefined;
    try {
      const { session, cookies } = await this.authService.refresh(rawRefresh);
      this.setAuthCookies(res, cookies);
      return session;
    } catch (err) {
      this.clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: RequestAuthContext,
  ) {
    const rawRefresh = req.cookies?.va_refresh_token as string | undefined;
    this.authService.logout(rawRefresh, user?.userId);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: RequestAuthContext) {
    return this.authService.getMe(user.userId);
  }

  private setAuthCookies(res: Response, cookies: IssuedAuthCookies): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('va_access_token', cookies.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: cookies.accessMaxAgeMs,
    });
    res.cookie('va_refresh_token', cookies.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: cookies.refreshMaxAgeMs,
    });
  }

  private clearAuthCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('va_access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('va_refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });
  }
}
