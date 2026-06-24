// prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'mysql://root:root@localhost:3306/space_defenders',
  },
  migrations: {
    seed: 'ts-node prisma/seed/seed.ts',
  },
});