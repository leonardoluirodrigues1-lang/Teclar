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
// O Render informa a porta em PORT; localmente fica a 3000.
const PORTA = Number(process.env.PORT) || 3000;
const PREFIXO = 'api';

// O front roda no Live Server do VS Code, que abre em 127.0.0.1 ou em
// localhost conforme a configuração — para o navegador são origens
// diferentes, por isso as duas. Qualquer outra origem é barrada pelo CORS.
// Em produção, CORS_ORIGIN traz a URL da Vercel (várias separadas por vírgula).
const ORIGENS_DO_FRONT = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  // A barra do fim sai: o navegador manda a origem sem ela.
  ...(process.env.CORS_ORIGIN ?? '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
];

async function iniciar(): Promise<void> {
  // bodyParser: false + useBodyParser abaixo: só para subir o limite do JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // 256 KB, e não os 100 KB padrão: a capa da turma vem em base64 (150 KB de
  // WEBP viram ~200 KB). O teto da imagem é conferido em turmas/capa.ts.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { extended: true });
  // No Render há TRÊS proxies na frente do back, medidos em produção (a
  // conexão chega de um proxy local; no X-Forwarded-For, da direita para a
  // esquerda: o balanceador interno do Render, 10.x, e a borda da Cloudflare,
  // que mudam a cada pedido; depois, o cliente). Com 3, req.ip é o cliente;
  // um X-Forwarded-For falso mandado por ele fica à esquerda e é ignorado.
  // Com 1, req.ip era o balanceador, diferente a cada pedido, e o limite de
  // tentativas (login, código da turma) nunca acumulava. Nunca `true`: aí
  // valeria o primeiro da lista, que o cliente escreve.
  // shortcut: o número supõe Cloudflare + Render na frente; se a hospedagem mudar, medir de novo.
  app.set('trust proxy', 3);
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
