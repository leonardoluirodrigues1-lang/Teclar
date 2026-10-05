// relatorios.module.ts
// Grupo "Relatórios (professor)" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   GET /turmas/:id/relatorio, GET /turmas/:id/relatorio/alunos,
//   GET /turmas/:id/relatorio/exercicios, GET /turmas/:id/alunos/:rp/sessoes
// Tudo sai de SessionsProf e chega pronto: a tela não calcula média.
import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller.js';

@Module({
  controllers: [RelatoriosController],
})
export class RelatoriosModule {}
