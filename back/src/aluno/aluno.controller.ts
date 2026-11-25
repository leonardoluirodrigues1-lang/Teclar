// As rotas HTTP do grupo "Aluno" (o próprio aluno logado). Só recebe e
// devolve: a regra está no AlunoService.
//
// O @Controller() vai sem prefixo porque o grupo tem dois: quatro rotas em
// /aluno e o relatório individual em /turmas/:turmaId/meu-desempenho. Cada
// rota escreve o caminho inteiro, para ficar à vista. O GuardaDoToken fica
// na classe, como nos outros controllers.
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken, PermitidoSemSenha } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import type { Paginado } from '../relatorios/relatorios.service.js';
import { AlunoService } from './aluno.service.js';
import type { AtividadeDoAluno, DesempenhoNaTurma, ResumoDoAluno, SalaDetalhe, SalaDoAluno, SessaoDoHistorico } from './aluno.service.js';
import type { ArquivoDoAnexo } from '../atribuicoes/posts.js';
import type { ImagemDaCapa } from '../turmas/turmas.service.js';

@Controller()
@UseGuards(GuardaDoToken)
export class AlunoController {
  constructor(private readonly aluno: AlunoService) {}

  @Post('aluno/senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PermitidoSemSenha()
  criarSenha(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: { novaSenha?: unknown }): Promise<void> {
    return this.aluno.criarSenha(requisicao.identidade, corpo);
  }

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

  @Get('aluno/salas/:turmaId/atividades/:exercicioId')
  atividade(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
  ): Promise<AtividadeDoAluno> {
    return this.aluno.atividade(requisicao.identidade, turmaId, exercicioId);
  }

  @Get('aluno/salas/:turmaId/atividades/:exercicioId/anexos/:anexoId')
  anexo(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Param('anexoId') anexoId: string,
  ): Promise<ArquivoDoAnexo> {
    return this.aluno.anexo(requisicao.identidade, turmaId, exercicioId, anexoId);
  }

  @Get('aluno/salas/:turmaId/capa')
  capa(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<ImagemDaCapa> {
    return this.aluno.capa(requisicao.identidade, turmaId);
  }

  @Get('turmas/:turmaId/meu-desempenho')
  meuDesempenho(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
  ): Promise<DesempenhoNaTurma> {
    return this.aluno.meuDesempenho(requisicao.identidade, turmaId);
  }
}
