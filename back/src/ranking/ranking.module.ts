// ranking.module.ts
// O ranking da turma, do grupo "Aluno" do CONTRATO-API.md:
// GET /turmas/:turmaId/ranking. As outras rotas do grupo Aluno (/aluno/...
// e meu-desempenho) ainda não estão implementadas.
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { RankingController } from './ranking.controller.js';
import { RankingService } from './ranking.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [RankingController],
  providers: [RankingService],
})
export class RankingModule {}
