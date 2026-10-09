// autenticacao.controller.ts
// As rotas HTTP do grupo Autenticação. Só recebe e devolve: a regra está
// no AutenticacaoService. As quatro do contrato existem: login, cadastro,
// eu e logout.
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AutenticacaoService } from './autenticacao.service.js';
import type { CorpoDoCadastro, CorpoDoLogin, RespostaLogin, Usuario } from './autenticacao.service.js';
import { GuardaDoToken } from './guarda-do-token.js';
import type { RequisicaoComIdentidade } from './guarda-do-token.js';

@Controller('auth')
export class AutenticacaoController {
  constructor(private readonly autenticacao: AutenticacaoService) {}

  // Rota pública: não passa pelo GuardaDoToken (é ela que dá o token).
  // @HttpCode porque o Nest responde POST com 201 (criado), e o contrato
  // diz 200: o login não cria recurso nenhum.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  entrar(@Body() corpo: CorpoDoLogin): Promise<RespostaLogin> {
    return this.autenticacao.entrar(corpo);
  }

  // Pública, como o login. Aqui sim se cria um recurso, mas o contrato diz
  // 200: a resposta é a mesma RespostaLogin do login, e a tela trata as
  // duas pelo mesmo caminho.
  @Post('cadastro')
  @HttpCode(HttpStatus.OK)
  cadastrar(@Body() corpo: CorpoDoCadastro): Promise<RespostaLogin> {
    return this.autenticacao.cadastrar(corpo);
  }

  // A primeira rota protegida: o GuardaDoToken roda antes e, se o token
  // vale, deixa a identidade em req.identidade. Sem token válido a
  // requisição nem chega aqui (401 TOKEN_INVALIDO).
  @Get('eu')
  @UseGuards(GuardaDoToken)
  eu(@Req() requisicao: RequisicaoComIdentidade): Promise<Usuario> {
    return this.autenticacao.quemSouEu(requisicao.identidade);
  }

  // Pública de propósito (ver o contrato): um 401 aqui derrubaria a tela no
  // meio da saída. Não faz nada no back — quem apaga a sessão é o front.
  // ponytail: o JWT continua valendo até vencer (8h). Para o logout
  // invalidar o token de verdade, falta uma lista de tokens revogados no
  // banco, conferida pelo GuardaDoToken.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  sair(): void {}
}
