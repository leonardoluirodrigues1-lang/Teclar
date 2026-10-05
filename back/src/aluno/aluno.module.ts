// aluno.module.ts
// Grupo "Aluno" do CONTRATO-API.md. Vazio por enquanto.
// Rotas que vão morar aqui:
//   GET /aluno/historico, GET /aluno/resumo, GET /aluno/salas,
//   GET /aluno/salas/:turmaId, GET /aluno/convites,
//   POST /aluno/convites/:turmaId/aceitar e /recusar,
//   GET /turmas/:turmaId/meu-desempenho, GET /turmas/:turmaId/ranking
// É o PRÓPRIO aluno logado (token de aluno, tabela Alunos). Não confundir
// com "alunos-e-convites", que é o professor administrando a turma.
import { Module } from '@nestjs/common';

@Module({})
export class AlunoModule {}
