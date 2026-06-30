import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { GoogleUserDto } from '../users/dto/google-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
}