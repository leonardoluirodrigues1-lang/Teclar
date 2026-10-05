// main.ts
// Ponto de entrada do back: sobe o Nest na porta 3000, sob /api, e libera o front.
//
// O dotenv vem no PRIMEIRO import: ele põe o .env em process.env, e o
// BancoService precisa do DATABASE_URL já na criação do AppModule.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// O front chama CONFIG.BASE_URL = 'http://localhost:3000/api' (js/config.ts)
// mais a rota do contrato: POST /auth/login vira /api/auth/login. Os dois
// valores abaixo têm de bater com essa URL.
const PORTA = 3000;
const PREFIXO = 'api';

// O front roda no Live Server do VS Code, que abre em 127.0.0.1 ou em
// localhost conforme a configuração — para o navegador são origens
// diferentes, por isso as duas. Qualquer outra origem é barrada pelo CORS.
const ORIGENS_DO_FRONT = ['http://127.0.0.1:5500', 'http://localhost:5500'];

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(PREFIXO);
  app.enableCors({ origin: ORIGENS_DO_FRONT });
  await app.listen(PORTA);
  console.log(`Back no ar em http://localhost:${PORTA}/${PREFIXO}`);
}

await iniciar();
