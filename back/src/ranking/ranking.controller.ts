// ranking.controller.ts
// A rota HTTP do ranking da turma (GET /turmas/:turmaId/ranking). Só recebe
// e devolve: a regra, e a anonimização, estão no RankingService.
//
// O GuardaDoToken fica na classe, como nos outros controllers.
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { RankingService } from './ranking.service.js';
import type { LinhaDoRanking } from './ranking.service.js';

@Controller('turmas/:turmaId/ranking')
@UseGuards(GuardaDoToken)
export class RankingController {
  constructor(private readonly ranking: RankingService) {}

  @Get()
  daTurma(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<LinhaDoRanking[]> {
    return this.ranking.daTurma(requisicao.identidade, turmaId);
  }
}
