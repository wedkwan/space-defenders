// prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/space_defenders',
  },
  migrations: {
    seed: 'ts-node prisma/seed/seed.ts',
  },
});