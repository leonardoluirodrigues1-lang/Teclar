// As rotas HTTP de /turmas/:turmaId/atribuicoes. Só recebe e devolve: a
// regra está no AtribuicoesService.
//
// O GuardaDoToken fica na classe, como em turmas: aqui não há rota
// pública, e uma rota nova não corre o risco de nascer sem ele.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { AtribuicoesService } from './atribuicoes.service.js';
import type { Atribuicao, AtribuicaoProfessor, CorpoDaAlteracao, CorpoDaAtribuicao } from './atribuicoes.service.js';
import { PostsService } from './posts.service.js';
import type { AnexoDoPost, ArquivoDoAnexo, CorpoDoAnexo, CorpoDoPost, PostDaAtividade } from './posts.js';

@Controller('turmas/:turmaId/atribuicoes')
@UseGuards(GuardaDoToken)
export class AtribuicoesController {
  constructor(
    private readonly atribuicoes: AtribuicoesService,
    private readonly posts: PostsService,
  ) {}

  @Get()
  listar(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<AtribuicaoProfessor[]> {
    return this.atribuicoes.listar(requisicao.identidade, turmaId);
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post()
  @HttpCode(HttpStatus.OK)
  atribuir(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Body() corpo: CorpoDaAtribuicao,
  ): Promise<Atribuicao[]> {
    return this.atribuicoes.atribuir(requisicao.identidade, turmaId, corpo);
  }

  @Patch(':exercicioId')
  alterar(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Body() corpo: CorpoDaAlteracao,
  ): Promise<Atribuicao> {
    return this.atribuicoes.alterar(requisicao.identidade, turmaId, exercicioId, corpo);
  }

  // --- o post da atividade (ver posts.service.ts) ---

  @Get(':exercicioId/post')
  lerPost(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
  ): Promise<PostDaAtividade> {
    return this.posts.ler(requisicao.identidade, turmaId, exercicioId);
  }

  @Put(':exercicioId/post')
  salvarPost(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Body() corpo: CorpoDoPost,
  ): Promise<PostDaAtividade> {
    return this.posts.salvar(requisicao.identidade, turmaId, exercicioId, corpo);
  }

  @Post(':exercicioId/post/anexos')
  @HttpCode(HttpStatus.OK)
  enviarAnexo(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Body() corpo: CorpoDoAnexo,
  ): Promise<AnexoDoPost> {
    return this.posts.enviarAnexo(requisicao.identidade, turmaId, exercicioId, corpo);
  }

  @Get(':exercicioId/post/anexos/:anexoId')
  baixarAnexo(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Param('anexoId') anexoId: string,
  ): Promise<ArquivoDoAnexo> {
    return this.posts.baixarAnexo(requisicao.identidade, turmaId, exercicioId, anexoId);
  }

  @Delete(':exercicioId/post/anexos/:anexoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removerAnexo(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
    @Param('anexoId') anexoId: string,
  ): Promise<void> {
    return this.posts.removerAnexo(requisicao.identidade, turmaId, exercicioId, anexoId);
  }

  @Delete(':exercicioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('exercicioId') exercicioId: string,
  ): Promise<void> {
    return this.atribuicoes.remover(requisicao.identidade, turmaId, exercicioId);
  }
}
