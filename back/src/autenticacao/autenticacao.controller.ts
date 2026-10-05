// autenticacao.controller.ts
// As rotas HTTP do grupo Autenticação. Só recebe e devolve: a regra está
// no AutenticacaoService. Pronta: POST /auth/login. As outras respondem
// 501 até serem implementadas (ver documentacao/nao-implementada.ts).
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Documentar, DocumentarNaoImplementada } from '../documentacao/documentar.js';
import { rotaNaoImplementada } from '../documentacao/nao-implementada.js';
import { AutenticacaoService } from './autenticacao.service.js';
import type { CorpoDoLogin, RespostaLogin } from './autenticacao.service.js';

@Controller('auth')
export class AutenticacaoController {
  constructor(private readonly autenticacao: AutenticacaoService) {}

  // Rota pública: não passa pelo GuardaDoToken (é ela que dá o token).
  // @HttpCode porque o Nest responde POST com 201 (criado), e o contrato
  // diz 200: o login não cria recurso nenhum.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Documentar('auth.entrar')
  entrar(@Body() corpo: CorpoDoLogin): Promise<RespostaLogin> {
    return this.autenticacao.entrar(corpo);
  }

  @Post('cadastro')
  @DocumentarNaoImplementada('auth.cadastrar')
  cadastrar(): never {
    throw rotaNaoImplementada();
  }

  @Get('eu')
  @DocumentarNaoImplementada('auth.eu')
  eu(): never {
    throw rotaNaoImplementada();
  }

  @Post('logout')
  @DocumentarNaoImplementada('auth.sair')
  sair(): never {
    throw rotaNaoImplementada();
  }
}
