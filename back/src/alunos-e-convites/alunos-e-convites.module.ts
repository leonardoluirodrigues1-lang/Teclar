// alunos-e-convites.module.ts
// Grupo "Alunos e convites (professor)" do CONTRATO-API.md. Vazio por enquanto.
// Rotas que vão morar aqui:
//   GET /turmas/:id/alunos, DELETE /turmas/:id/alunos/:rp,
//   POST /turmas/:id/convites, POST /turmas/:id/convites/importar,
//   DELETE /turmas/:id/convites/:rp, GET /turmas/:id/alunos/:rp/desempenho
// É o PROFESSOR administrando o quadro de uma turma dele (tabela
// ClassMembers). Não confundir com o módulo "aluno", que é o próprio
// aluno logado.
import { Module } from '@nestjs/common';

@Module({})
export class AlunosEConvitesModule {}
