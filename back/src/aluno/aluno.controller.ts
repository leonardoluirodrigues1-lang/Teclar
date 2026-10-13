// aluno.controller.ts
// As rotas HTTP do grupo "Aluno" (o próprio aluno logado). Só recebe e
// devolve: a regra está no AlunoService.
//
// O @Controller() vai sem prefixo porque o grupo tem dois: quatro rotas em
// /aluno e o relatório individual em /turmas/:turmaId/meu-desempenho. Cada
// rota escreve o caminho inteiro, para ficar à vista. O GuardaDoToken fica
// na classe, como nos outros controllers.
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import type { Paginado } from '../relatorios/relatorios.service.js';
import { AlunoService } from './aluno.service.js';
import type { DesempenhoNaTurma, ResumoDoAluno, SalaDetalhe, SalaDoAluno, SessaoDoHistorico } from './aluno.service.js';

@Controller()
@UseGuards(GuardaDoToken)
export class AlunoController {
  constructor(private readonly aluno: AlunoService) {}

  @Get('aluno/historico')
  historico(@Req() requisicao: RequisicaoComIdentidade): Promise<Paginado<SessaoDoHistorico>> {
    return this.aluno.historico(requisicao.identidade);
  }

  @Get('aluno/resumo')
  resumo(@Req() requisicao: RequisicaoComIdentidade): Promise<ResumoDoAluno> {
    return this.aluno.resumo(requisicao.identidade);
  }

  @Get('aluno/salas')
  salas(@Req() requisicao: RequisicaoComIdentidade): Promise<SalaDoAluno[]> {
    return this.aluno.salas(requisicao.identidade);
  }

  @Get('aluno/salas/:turmaId')
  sala(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<SalaDetalhe> {
    return this.aluno.sala(requisicao.identidade, turmaId);
  }

  @Get('turmas/:turmaId/meu-desempenho')
  meuDesempenho(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
  ): Promise<DesempenhoNaTurma> {
    return this.aluno.meuDesempenho(requisicao.identidade, turmaId);
  }
}
