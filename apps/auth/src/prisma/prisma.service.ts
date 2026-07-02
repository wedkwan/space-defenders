import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    this.prismaClient = new PrismaClient({ adapter });

    // O Proxy repassa todas as propriedades (como .user, .$connect) dinamicamente
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop as keyof PrismaService];
        }
        return (target.prismaClient as any)[prop];
      },
    });
  }

  async onModuleInit() {
    await this.prismaClient.$connect();
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
  }
}

// Essa linha força o TypeScript a mesclar a tipagem do PrismaClient dentro do PrismaService
export interface PrismaService extends PrismaClient {}