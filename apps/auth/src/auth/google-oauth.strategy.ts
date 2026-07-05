import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleUserDto } from '../users/dto/google-user.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static configured = false;

  constructor(private prisma: PrismaService) {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL;

    if (!clientID || !clientSecret || !callbackURL) {
      Logger.warn('Google OAuth não configurado — login via Google desabilitado', 'GoogleStrategy');
      super({
        clientID: 'disabled',
        clientSecret: 'disabled',
        callbackURL: 'http://localhost:3001/auth/google/callback',
        scope: ['profile', 'email'],
      });
      return;
    }

    GoogleStrategy.configured = true;
    super({ clientID, clientSecret, callbackURL, scope: ['profile', 'email'] });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    if (!GoogleStrategy.configured) {
      return done(new Error('Google OAuth não configurado'), undefined);
    }

    const { id, name, emails, photos } = profile;

    const user: GoogleUserDto = {
      provider: 'google',
      providerId: id,
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`,
      picture: photos[0].value,
    };

    done(null, user);
  }
}