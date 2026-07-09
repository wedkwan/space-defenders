import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google-oauth.strategy';
import { MailModule } from '../mail/mail.module';
import { VerificationTokenModule } from './verification-token.module';
import { UsersModule } from '../users/users.module';

const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1d';

@Module({
  imports: [
    MailModule,
    VerificationTokenModule,
    UsersModule,
    PassportModule.register({ session: false }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: jwtExpiresIn as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {} 