// relatorios.controller.ts
// As rotas HTTP do grupo Relatórios (professor). Nenhuma implementada
// ainda: todas respondem 501, e o Swagger mostra o contrato de cada uma.
import { Controller, Get } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('turmas')
export class RelatoriosController {
  @Get(':id/relatorio')
  @DocumentarNaoImplementada('relatorios.turma')
  turma(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id/relatorio/alunos')
  @DocumentarNaoImplementada('relatorios.porAluno')
  porAluno(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id/relatorio/exercicios')
  @DocumentarNaoImplementada('relatorios.porExercicio')
  porExercicio(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id/alunos/:rp/sessoes')
  @DocumentarNaoImplementada('relatorios.sessoesDoAluno')
  sessoesDoAluno(): never {
    throw rotaNaoImplementada();
  }
}
