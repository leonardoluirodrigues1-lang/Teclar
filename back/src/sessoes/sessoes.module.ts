// sessoes.module.ts
// Grupo "Sessões" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   POST /sessoes, GET /sessoes/:id
// Grava a sessão do mundo Escola (SessionsProf) e relê uma sessão Escola
// ou Solo para a tela de resultado.
import { Module } from '@nestjs/common';
import { SessoesController } from './sessoes.controller.js';

@Module({
  controllers: [SessoesController],
})
export class SessoesModule {}
