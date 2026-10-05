// aluno.module.ts
// Grupo "Aluno" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   GET /aluno/historico, GET /aluno/resumo, GET /aluno/salas,
//   GET /aluno/salas/:turmaId, GET /aluno/convites,
//   POST /aluno/convites/:turmaId/aceitar e /recusar,
//   GET /turmas/:turmaId/meu-desempenho, GET /turmas/:turmaId/ranking
// É o PRÓPRIO aluno logado (token de aluno, tabela Alunos). Não confundir
// com "alunos-e-convites", que é o professor administrando a turma.
import { Module } from '@nestjs/common';
import { AlunoController } from './aluno.controller.js';

@Module({
  controllers: [AlunoController],
})
export class AlunoModule {}
