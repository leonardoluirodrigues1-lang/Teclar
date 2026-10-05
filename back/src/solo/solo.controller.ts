// solo.controller.ts
// As rotas HTTP do grupo Solo. Nenhuma implementada ainda: todas
// respondem 501, e o Swagger mostra o contrato que cada uma vai cumprir.
import { Controller, Delete, Get, Post } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller('solo')
export class SoloController {
  @Get('campanha')
  @DocumentarNaoImplementada('solo.campanhaAtual')
  campanhaAtual(): never {
    throw rotaNaoImplementada();
  }

  @Post('campanha')
  @DocumentarNaoImplementada('solo.criarCampanha')
  criarCampanha(): never {
    throw rotaNaoImplementada();
  }

  @Get('campanhas/:id')
  @DocumentarNaoImplementada('solo.campanha')
  campanha(): never {
    throw rotaNaoImplementada();
  }

  @Delete('campanhas/:id')
  @DocumentarNaoImplementada('solo.apagarCampanha')
  apagarCampanha(): never {
    throw rotaNaoImplementada();
  }

  @Get('missoes')
  @DocumentarNaoImplementada('solo.missoes')
  missoes(): never {
    throw rotaNaoImplementada();
  }

  @Get('missoes/:id')
  @DocumentarNaoImplementada('solo.missao')
  missao(): never {
    throw rotaNaoImplementada();
  }

  @Post('sessoes')
  @DocumentarNaoImplementada('solo.registrarSessao')
  registrarSessao(): never {
    throw rotaNaoImplementada();
  }

  @Get('historico')
  @DocumentarNaoImplementada('solo.historico')
  historico(): never {
    throw rotaNaoImplementada();
  }

  @Get('indicadores')
  @DocumentarNaoImplementada('solo.indicadores')
  indicadores(): never {
    throw rotaNaoImplementada();
  }

  @Get('estatisticas')
  @DocumentarNaoImplementada('solo.estatisticas')
  estatisticas(): never {
    throw rotaNaoImplementada();
  }
}
