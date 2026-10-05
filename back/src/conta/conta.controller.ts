// conta.controller.ts
// As rotas HTTP do grupo Conta. Nenhuma implementada ainda: todas
// respondem 501, e o Swagger mostra o contrato que cada uma vai cumprir.
import { Controller, Get, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('conta')
export class ContaController {
  @Get('rp')
  @DocumentarNaoImplementada('conta.rp')
  rp(): never {
    throw rotaNaoImplementada();
  }

  @Post('rp/nova-senha')
  @DocumentarNaoImplementada('conta.novaSenhaAluno')
  novaSenhaAluno(): never {
    throw rotaNaoImplementada();
  }
}
