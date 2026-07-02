import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { GoogleUserDto } from '../users/dto/google-user.dto';
import { MailService } from '../mail/mail.service';
import { VerificationTokenService } from './verification-token.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private verificationTokenService: VerificationTokenService,
  ) {}

  async validateLocalUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  async login(user: { id: string; email: string; name: string; role: Role }) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateOAuthUser(profile: GoogleUserDto) {
    const existingUser = await this.usersService.findByEmail(profile.email);

    if (existingUser) {
      const { password: _password, ...safeUser } = existingUser;
      return this.login(safeUser);
    }

    const newUser = await this.usersService.create({
      name: profile.name,
      email: profile.email,
      provider: profile.provider,
    });

    return this.login(newUser);
  }

  async verifyEmail(token: string) {
    let userId: string;

    try {
      userId = await this.verificationTokenService.validateAndConsume(token);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    await this.usersService.markEmailAsVerified(userId);

    return { message: 'E-mail verificado com sucesso' };
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: 'Se o e-mail existir, um novo link foi enviado' };
    }

    if (user.emailVerified) {
      throw new ConflictException('E-mail já verificado');
    }

    const token = await this.verificationTokenService.createToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, token);

    return { message: 'Se o e-mail existir, um novo link foi enviado' };
  }
}