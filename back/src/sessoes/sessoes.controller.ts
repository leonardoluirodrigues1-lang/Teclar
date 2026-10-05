// sessoes.controller.ts
// As rotas HTTP do grupo Sessões. Nenhuma implementada ainda: todas
// respondem 501, e o Swagger mostra o contrato de cada uma.
import { Controller, Get, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('sessoes')
export class SessoesController {
  @Post()
  @DocumentarNaoImplementada('sessoes.registrar')
  registrar(): never {
    throw rotaNaoImplementada();
  }

  @Get(':id')
  @DocumentarNaoImplementada('sessoes.obter')
  obter(): never {
    throw rotaNaoImplementada();
  }
}
