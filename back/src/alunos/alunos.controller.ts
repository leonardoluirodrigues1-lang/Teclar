// alunos.controller.ts
// As rotas HTTP do grupo "Alunos (professor)". Só recebe e devolve: a
// regra está no AlunosService.
//
// O GuardaDoToken fica na classe, como em turmas: aqui não há rota
// pública, e uma rota nova não corre o risco de nascer sem ele.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { AlunosService } from './alunos.service.js';
import type { Aluno, CorpoDaImportacao, DesempenhoAluno, ResultadoImportacao } from './alunos.service.js';

@Controller('turmas/:turmaId/alunos')
@UseGuards(GuardaDoToken)
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}

  @Get()
  listar(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<Aluno[]> {
    return this.alunos.listar(requisicao.identidade, turmaId);
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post('importar')
  @HttpCode(HttpStatus.OK)
  importar(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Body() corpo: CorpoDaImportacao,
  ): Promise<ResultadoImportacao> {
    return this.alunos.importar(requisicao.identidade, turmaId, corpo);
  }

  @Delete(':alunoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('alunoId') alunoId: string,
  ): Promise<void> {
    return this.alunos.remover(requisicao.identidade, turmaId, alunoId);
  }

  @Post(':alunoId/zerar-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  zerarSenha(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('alunoId') alunoId: string,
  ): Promise<void> {
    return this.alunos.zerarSenha(requisicao.identidade, turmaId, alunoId);
  }

  @Get(':alunoId/desempenho')
  desempenho(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('alunoId') alunoId: string,
  ): Promise<DesempenhoAluno> {
    return this.alunos.desempenho(requisicao.identidade, turmaId, alunoId);
  }
}
