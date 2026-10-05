// swagger.ts
// Serve a documentação da API em /api/docs (e o JSON em /api/docs-json).
//
// O documento não é montado aqui: é o back/openapi.json, que o
// gerar-contrato.mjs (na raiz do repositório) gera do mesmo api.ts que gera
// o CONTRATO-API.md. Ele tem as 55 rotas do contrato, inclusive as que o
// back ainda não implementa, marcadas "(ainda não implementada)".
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

// Relativo a este arquivo, e não à pasta de onde o back foi iniciado:
// dist/swagger.js -> ../openapi.json = back/openapi.json.
const ARQUIVO_OPENAPI = new URL('../openapi.json', import.meta.url);

export function montarSwagger(app: INestApplication): void {
  const documento = JSON.parse(readFileSync(ARQUIVO_OPENAPI, 'utf8')) as OpenAPIObject;
  // O SwaggerModule não usa o prefixo global (/api), então o caminho vai inteiro.
  SwaggerModule.setup('api/docs', app, documento);
}
