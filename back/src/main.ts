// main.ts
// Ponto de entrada do back: sobe o Nest na porta 3000, sob /api, e libera o front.
//
// O dotenv vem no PRIMEIRO import: ele põe o .env em process.env, e o
// BancoService precisa do DATABASE_URL já na criação do AppModule.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { montarSwagger } from './swagger.js';

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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // No Render o back fica atrás de um proxy: sem isto, req.ip seria o IP do
  // proxy, e o limite de tentativas contaria todo mundo como um só.
  app.set('trust proxy', 1);
  app.setGlobalPrefix(PREFIXO);
  app.enableCors({ origin: ORIGENS_DO_FRONT });
  // Cabeçalhos de segurança. O CSP padrão do helmet já serve o Swagger
  // (scripts em arquivo do próprio back, estilo inline liberado); só sai o
  // upgrade-insecure-requests: o back é HTTP e, aberto pelo IP da rede, o
  // navegador iria buscar o CSS e o JS do Swagger em HTTPS e não acharia.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  montarSwagger(app);
  await app.listen(PORTA);
  console.log(`Back no ar em http://localhost:${PORTA}/${PREFIXO}`);
  console.log(`Swagger em http://localhost:${PORTA}/${PREFIXO}/docs`);
}

await iniciar();
