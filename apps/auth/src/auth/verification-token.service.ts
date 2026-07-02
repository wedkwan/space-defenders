import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TOKEN_TTL_HOURS = 24;

@Injectable()
export class VerificationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async createToken(userId: string): Promise<string> {
    // invalida tokens antigos do mesmo usuário
    await this.prisma.verificationToken.deleteMany({ where: { userId } });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.verificationToken.create({
      data: { token, userId, expiresAt },
    });

    return token;
  }

  async validateAndConsume(token: string): Promise<string> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new Error('Token inválido');
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.verificationToken.delete({ where: { token } });
      throw new Error('Token expirado');
    }

    await this.prisma.verificationToken.delete({ where: { token } });

    return record.userId;
  }
}