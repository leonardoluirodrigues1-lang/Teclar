// turmas.module.ts
// Grupo "Turmas (professor)" do CONTRATO-API.md. Vazio por enquanto.
// Rotas que vão morar aqui:
//   GET /turmas (e ?ativa=false), POST /turmas, GET /turmas/:id,
//   PATCH /turmas/:id (renomear, trocar capa, arquivar, desarquivar),
//   GET e POST /turmas/:id/atribuicoes,
//   DELETE /turmas/:id/atribuicoes/:exercicioId
// Tabelas ClassesProf e AtribuicoesProf.
import { Module } from '@nestjs/common';

@Module({})
export class TurmasModule {}
