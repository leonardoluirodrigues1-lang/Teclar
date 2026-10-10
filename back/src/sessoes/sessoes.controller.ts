// sessoes.controller.ts
// As rotas HTTP do grupo "Sessões". Só recebe e devolve: a regra está no
// SessoesService.
//
// O GuardaDoToken fica na classe: as duas rotas exigem login. O tipo do
// token é conferido no service, porque cada rota aceita um tipo diferente
// (o POST só aluno; o GET os dois, cada um na sua tabela).
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { SessoesService } from './sessoes.service.js';
import type { CorpoDaSessao, RespostaSessaoEscola, SessaoEscola, SessaoSolo } from './sessoes.service.js';

@Controller('sessoes')
@UseGuards(GuardaDoToken)
export class SessoesController {
  constructor(private readonly sessoes: SessoesService) {}

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post()
  @HttpCode(HttpStatus.OK)
  registrar(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDaSessao): Promise<RespostaSessaoEscola> {
    return this.sessoes.registrar(requisicao.identidade, corpo);
  }

  @Get(':id')
  obter(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<SessaoEscola | SessaoSolo> {
    return this.sessoes.obter(requisicao.identidade, id);
  }
}
