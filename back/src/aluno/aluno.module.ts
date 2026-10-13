// aluno.module.ts
// Grupo "Aluno" do CONTRATO-API.md: as telas do PRÓPRIO aluno logado
// (histórico, resumo, salas e o relatório individual). O ranking da turma,
// que também é do grupo, está no RankingModule (src/ranking/), porque
// nasceu antes e tem a regra de anonimização dele.
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { AlunoController } from './aluno.controller.js';
import { AlunoService } from './aluno.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [AlunoController],
  providers: [AlunoService],
})
export class AlunoModule {}
