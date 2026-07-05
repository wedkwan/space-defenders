import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login com email e senha' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso, retorna o token JWT' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
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
  @ApiOperation({ summary: 'Inicia o fluxo de login com Google' })
  googleAuth() {}

  @Public()
  @UseGuards(GoogleOauthGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback do Google OAuth' })
  async googleAuthRedirect(@Req() req: { user: any }, @Res() res: any) {
    const result = await this.authService.validateOAuthUser(req.user);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.access_token}`);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verifica o e-mail do usuário através do token' })
  @ApiResponse({ status: 200, description: 'E-mail verificado com sucesso' })
  @ApiResponse({ status: 400, description: 'Token não informado ou inválido' })
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token não informado');
    }
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({ summary: 'Reenvia o e-mail de verificação' })
  @ApiResponse({ status: 200, description: 'E-mail reenviado com sucesso' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  getProfile(@Req() req: { user: { id: string; email: string; name: string; role: string } }) {
    return req.user;
  }
}