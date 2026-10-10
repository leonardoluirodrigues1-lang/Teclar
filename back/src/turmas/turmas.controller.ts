// turmas.controller.ts
// As rotas HTTP do grupo "Turmas (professor)". Só recebe e devolve: a
// regra está no TurmasService.
//
// O GuardaDoToken fica na classe, e não em cada rota: aqui não há rota
// pública, e uma rota nova não corre o risco de nascer sem ele.
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { TurmasService } from './turmas.service.js';
import type { CodigoDaTurma, CorpoDaAlteracao, CorpoDaTurmaNova, Turma } from './turmas.service.js';

@Controller('turmas')
@UseGuards(GuardaDoToken)
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  // GET /turmas e GET /turmas?ativa=false: a mesma rota, só o filtro muda.
  @Get()
  listar(@Req() requisicao: RequisicaoComIdentidade, @Query('ativa') ativa?: string): Promise<Turma[]> {
    return this.turmas.listar(requisicao.identidade, ativa);
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post()
  @HttpCode(HttpStatus.OK)
  criar(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDaTurmaNova): Promise<Turma> {
    return this.turmas.criar(requisicao.identidade, corpo);
  }

  // Renomear, trocar a capa, arquivar e desarquivar: o corpo diz qual.
  @Patch(':id')
  alterar(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('id') id: string,
    @Body() corpo: CorpoDaAlteracao,
  ): Promise<Turma> {
    return this.turmas.alterar(requisicao.identidade, id, corpo);
  }

  @Post(':id/codigo/novo')
  @HttpCode(HttpStatus.OK)
  novoCodigo(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<CodigoDaTurma> {
    return this.turmas.novoCodigo(requisicao.identidade, id);
  }
}
