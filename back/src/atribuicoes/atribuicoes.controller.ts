// atribuicoes.controller.ts
// As rotas HTTP de /turmas/:turmaId/atribuicoes. Só recebe e devolve: a
// regra está no AtribuicoesService.
//
// O GuardaDoToken fica na classe, como em turmas: aqui não há rota
// pública, e uma rota nova não corre o risco de nascer sem ele.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { AtribuicoesService } from './atribuicoes.service.js';
import type { Atribuicao, AtribuicaoProfessor, CorpoDaAtribuicao } from './atribuicoes.service.js';

@Controller('turmas/:turmaId/atribuicoes')
@UseGuards(GuardaDoToken)
export class AtribuicoesController {
  constructor(private readonly atribuicoes: AtribuicoesService) {}

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
