// aluno.controller.ts
// As rotas HTTP do grupo Aluno (o próprio aluno logado). Nenhuma
// implementada ainda: todas respondem 501, e o Swagger mostra o contrato
// de cada uma.
//
// O @Controller() vai sem prefixo porque o grupo mora em dois lugares:
// quase tudo em /aluno, mas o desempenho e o ranking da sala ficam sob
// /turmas/:turmaId. Cada rota escreve o caminho inteiro.
import { Controller, Get, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller()
export class AlunoController {
  @Get('aluno/historico')
  @DocumentarNaoImplementada('escola.aluno.historico')
  historico(): never {
    throw rotaNaoImplementada();
  }

  @Get('aluno/resumo')
  @DocumentarNaoImplementada('escola.aluno.resumo')
  resumo(): never {
    throw rotaNaoImplementada();
  }

  @Get('aluno/salas')
  @DocumentarNaoImplementada('escola.aluno.salas')
  salas(): never {
    throw rotaNaoImplementada();
  }

  @Get('aluno/salas/:turmaId')
  @DocumentarNaoImplementada('escola.aluno.sala')
  sala(): never {
    throw rotaNaoImplementada();
  }

  @Get('aluno/convites')
  @DocumentarNaoImplementada('escola.aluno.convites')
  convites(): never {
    throw rotaNaoImplementada();
  }

  @Post('aluno/convites/:turmaId/aceitar')
  @DocumentarNaoImplementada('escola.aluno.aceitarConvite')
  aceitarConvite(): never {
    throw rotaNaoImplementada();
  }

  @Post('aluno/convites/:turmaId/recusar')
  @DocumentarNaoImplementada('escola.aluno.recusarConvite')
  recusarConvite(): never {
    throw rotaNaoImplementada();
  }

  @Get('turmas/:turmaId/meu-desempenho')
  @DocumentarNaoImplementada('escola.aluno.desempenhoNaTurma')
  desempenhoNaTurma(): never {
    throw rotaNaoImplementada();
  }

  @Get('turmas/:turmaId/ranking')
  @DocumentarNaoImplementada('escola.aluno.rankingDaTurma')
  rankingDaTurma(): never {
    throw rotaNaoImplementada();
  }
}
