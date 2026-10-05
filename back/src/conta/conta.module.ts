// conta.module.ts
// Grupo "Conta" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   GET /conta/rp, POST /conta/rp/nova-senha
// É a conta logada (tabela Users) fora de qualquer mundo: o RP dela e a
// troca da senha de aluno.
import { Module } from '@nestjs/common';
import { ContaController } from './conta.controller.js';

@Module({
  controllers: [ContaController],
})
export class ContaModule {}
