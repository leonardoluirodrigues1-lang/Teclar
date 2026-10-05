// alunos-e-convites.controller.ts
// As rotas HTTP do grupo Alunos e convites (professor). Nenhuma
// implementada ainda: todas respondem 501, e o Swagger mostra o contrato
// de cada uma. Ficam sob /turmas porque são sempre de UMA turma.
import { Controller, Delete, Get, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('turmas')
export class AlunosEConvitesController {
  @Get(':id/alunos')
  @DocumentarNaoImplementada('alunos.daTurma')
  daTurma(): never {
    throw rotaNaoImplementada();
  }

  @Delete(':id/alunos/:rp')
  @DocumentarNaoImplementada('alunos.remover')
  remover(): never {
    throw rotaNaoImplementada();
  }

  @Post(':id/convites')
  @DocumentarNaoImplementada('alunos.convidar')
  convidar(): never {
    throw rotaNaoImplementada();
  }

  @Post(':id/convites/importar')
  @DocumentarNaoImplementada('alunos.convidarVarios')
  convidarVarios(): never {
    throw rotaNaoImplementada();
  }

  @Delete(':id/convites/:rp')
  @DocumentarNaoImplementada('alunos.cancelarConvite')
  cancelarConvite(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id/alunos/:rp/desempenho')
  @DocumentarNaoImplementada('alunos.desempenho')
  desempenho(): never {
    throw rotaNaoImplementada();
  }
}
