// administracao.controller.ts
// As rotas HTTP do grupo "Administração": categorias e parâmetros globais.
// Só recebe e devolve: a regra está nos dois services.
//
// O GuardaDoToken fica na classe: nenhuma rota daqui é pública. As de
// leitura aceitam qualquer token válido; as de escrita conferem, no
// service, se a conta é administradora (senão 404).
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { CategoriasService } from './categorias.service.js';
import type { Categoria, CorpoDaCategoria } from './categorias.service.js';
import { ParametrosService } from './parametros.service.js';
import type { Parametros } from './parametros.service.js';

@Controller()
@UseGuards(GuardaDoToken)
export class AdministracaoController {
  constructor(
    private readonly categorias: CategoriasService,
    private readonly parametros: ParametrosService,
  ) {}

  // --- categorias ----------------------------------------------------------

  @Get('categorias')
  listarCategorias(): Promise<Categoria[]> {
    return this.categorias.listar();
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post('categorias')
  @HttpCode(HttpStatus.OK)
  criarCategoria(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDaCategoria): Promise<Categoria> {
    return this.categorias.criar(requisicao.identidade, corpo);
  }

  @Patch('categorias/:id')
  renomearCategoria(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('id') id: string,
    @Body() corpo: CorpoDaCategoria,
  ): Promise<Categoria> {
    return this.categorias.renomear(requisicao.identidade, id, corpo);
  }

  @Delete('categorias/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  apagarCategoria(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<void> {
    return this.categorias.apagar(requisicao.identidade, id);
  }

  // --- parâmetros ----------------------------------------------------------

  @Get('parametros')
  lerParametros(): Promise<Parametros> {
    return this.parametros.ler();
  }

  // O corpo vai como unknown: só o service sabe quais campos valem.
  @Put('parametros')
  salvarParametros(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: unknown): Promise<Parametros> {
    return this.parametros.salvar(requisicao.identidade, corpo);
  }
}
