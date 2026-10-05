// prisma.config.ts
// Configuração da CLI do Prisma (db pull, generate, studio).
// No Prisma 7 a URL do banco saiu do schema.prisma e veio para cá.
//
// A CLI não lê o .env sozinha: o import do dotenv abaixo é que carrega o
// DATABASE_URL antes de o env() procurá-lo.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
