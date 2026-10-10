// alunos.module.ts
// Grupo "Alunos (professor)" do CONTRATO-API.md. Pronto inteiro:
//   GET /turmas/:id/alunos, POST /turmas/:id/alunos/importar,
//   DELETE /turmas/:id/alunos/:alunoId,
//   POST /turmas/:id/alunos/:alunoId/zerar-senha,
//   GET /turmas/:id/alunos/:alunoId/desempenho
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { AlunosController } from './alunos.controller.js';
import { AlunosService } from './alunos.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [AlunosController],
  providers: [AlunosService],
  // Exportado para o RelatoriosModule reaproveitar a linha do aluno.
  exports: [AlunosService],
})
export class AlunosModule {}
