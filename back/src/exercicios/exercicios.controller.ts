// exercicios.controller.ts
// As rotas HTTP do grupo Biblioteca de exercícios (professor). Nenhuma
// implementada ainda: todas respondem 501, e o Swagger mostra o contrato
// de cada uma.
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('exercicios')
export class ExerciciosController {
  @Get()
  @DocumentarNaoImplementada('exercicios.listar')
  listar(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id')
  @DocumentarNaoImplementada('exercicios.obter')
  obter(): never {
    throw rotaNaoImplementada();
  }

  @Post()
  @DocumentarNaoImplementada('exercicios.criar')
  criar(): never {
    throw rotaNaoImplementada();
  }

  @Patch(':id')
  @DocumentarNaoImplementada('exercicios.atualizar')
  atualizar(): never {
    throw rotaNaoImplementada();
  }

  @Delete(':id')
  @DocumentarNaoImplementada('exercicios.excluir')
  excluir(): never {
    throw rotaNaoImplementada();
  }
}
