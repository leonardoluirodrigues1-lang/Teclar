// administracao.controller.ts
// As rotas HTTP do grupo Administração. Nenhuma implementada ainda: todas
// respondem 501, e o Swagger mostra o contrato de cada uma.
// @Controller() sem prefixo: o grupo tem dois endereços, /categorias e
// /parametros.
import { Controller, Delete, Get, Patch, Post, Put } from '@nestjs/common';
import { DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';

@Controller()
export class AdministracaoController {
  @Get('categorias')
  @DocumentarNaoImplementada('admin.categorias')
  categorias(): never {
    throw rotaNaoImplementada();
  }

  @Post('categorias')
  @DocumentarNaoImplementada('admin.criarCategoria')
  criarCategoria(): never {
    throw rotaNaoImplementada();
  }

  @Patch('categorias/:id')
  @DocumentarNaoImplementada('admin.renomearCategoria')
  renomearCategoria(): never {
    throw rotaNaoImplementada();
  }

  @Delete('categorias/:id')
  @DocumentarNaoImplementada('admin.apagarCategoria')
  apagarCategoria(): never {
    throw rotaNaoImplementada();
  }

  @Get('parametros')
  @DocumentarNaoImplementada('admin.parametros')
  parametros(): never {
    throw rotaNaoImplementada();
  }

  @Put('parametros')
  @DocumentarNaoImplementada('admin.salvarParametros')
  salvarParametros(): never {
    throw rotaNaoImplementada();
  }
}
