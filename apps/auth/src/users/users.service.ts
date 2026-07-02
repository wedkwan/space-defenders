import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import { VerificationTokenService } from '../auth/verification-token.service';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  provider: true,
  role: true,
  emailVerified: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly verificationTokenService: VerificationTokenService,
  ) {}

  async create(data: CreateUserDto) {
    const provider = data.provider ?? 'local';

    if (provider === 'local' && !data.password) {
      throw new BadRequestException('Senha é obrigatória para cadastro local');
    }

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        provider,
      },
      select: SAFE_USER_SELECT,
    });

    if (provider === 'local') {
      const token = await this.verificationTokenService.createToken(user.id);
      await this.mailService.sendVerificationEmail(user.email, token);
    }

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: SAFE_USER_SELECT,
    });
  }

  

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: SAFE_USER_SELECT,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  }

  async markEmailAsVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
      select: SAFE_USER_SELECT,
    });
  }
}