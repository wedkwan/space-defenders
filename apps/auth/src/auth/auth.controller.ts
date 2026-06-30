import { Body, Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateLocalUser(
      loginDto.email,
      loginDto.password,
    );
    return this.authService.login(user);
  }

  @Public()
  @UseGuards(GoogleOauthGuard)
  @Get('google')
  googleAuth() {
    // o Guard intercepta a requisição e redireciona pro Google
    // esse corpo nunca chega a executar
  }

  @Public()
  @UseGuards(GoogleOauthGuard)
  @Get('google/callback')
  async googleAuthRedirect(@Req() req: { user: any }) {
    return this.authService.validateOAuthUser(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: { user: { id: string; email: string; name: string; role: string } }) {
    return req.user;
  }
}