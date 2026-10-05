// turmas.controller.ts
// As rotas HTTP do grupo Turmas (professor). Nenhuma implementada ainda:
// todas respondem 501, e o Swagger mostra o contrato de cada uma.
//
// O contrato lista 11 chamadas, mas são 7 rotas HTTP: o GET /turmas serve
// a listar() e a listarArquivadas() (só muda o ?ativa=false), e o
// PATCH /turmas/:id serve a quatro (renomear, trocar a capa, arquivar e
// desarquivar — cada uma manda um campo diferente no corpo).
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('turmas')
export class TurmasController {
  @Get()
  @DocumentarNaoImplementada('turmas.listar', 'turmas.listarArquivadas')
  listar(): never {
    throw rotaNaoImplementada();
  }

  @Post()
  @DocumentarNaoImplementada('turmas.criar')
  criar(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id')
  @DocumentarNaoImplementada('turmas.obter')
  obter(): never {
    throw rotaNaoImplementada();
  }

  @Patch(':id')
  @DocumentarNaoImplementada('turmas.renomear', 'turmas.trocarCapa', 'turmas.arquivar', 'turmas.desarquivar')
  atualizar(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id/atribuicoes')
  @DocumentarNaoImplementada('turmas.atribuicoes')
  atribuicoes(): never {
    throw rotaNaoImplementada();
  }

  @Post(':id/atribuicoes')
  @DocumentarNaoImplementada('turmas.atribuir')
  atribuir(): never {
    throw rotaNaoImplementada();
  }

  @Delete(':id/atribuicoes/:exercicioId')
  @DocumentarNaoImplementada('turmas.removerAtribuicao')
  removerAtribuicao(): never {
    throw rotaNaoImplementada();
  }
}
