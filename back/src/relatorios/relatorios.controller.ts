// relatorios.controller.ts
// As rotas HTTP do grupo "Relatórios (professor)". Só recebe e devolve: a
// regra está no RelatoriosService.
//
// O GuardaDoToken fica na classe, como nos outros grupos do professor: aqui
// não há rota pública, e uma rota nova não corre o risco de nascer sem ele.
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { RelatoriosService } from './relatorios.service.js';
import type {
  Paginado,
  RelatorioAluno,
  RelatorioExercicio,
  RelatorioTurma,
  SessaoDoAluno,
} from './relatorios.service.js';

@Controller('turmas/:turmaId')
@UseGuards(GuardaDoToken)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('relatorio')
  daTurma(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<RelatorioTurma> {
    return this.relatorios.daTurma(requisicao.identidade, turmaId);
  }

  @Get('relatorio/alunos')
  porAluno(@Req() requisicao: RequisicaoComIdentidade, @Param('turmaId') turmaId: string): Promise<RelatorioAluno[]> {
    return this.relatorios.porAluno(requisicao.identidade, turmaId);
  }

  @Get('relatorio/exercicios')
  porExercicio(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
  ): Promise<RelatorioExercicio[]> {
    return this.relatorios.porExercicio(requisicao.identidade, turmaId);
  }

  // Fica aqui, e não no AlunosController, porque no contrato ela é do grupo
  // Relatórios: é o modal de histórico da tela de relatórios.
  @Get('alunos/:alunoId/sessoes')
  sessoesDoAluno(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('turmaId') turmaId: string,
    @Param('alunoId') alunoId: string,
  ): Promise<Paginado<SessaoDoAluno>> {
    return this.relatorios.sessoesDoAluno(requisicao.identidade, turmaId, alunoId);
  }
}
