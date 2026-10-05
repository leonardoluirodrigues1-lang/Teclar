// autenticacao.controller.ts
// As rotas HTTP do grupo Autenticação. Só recebe e devolve: a regra está
// no AutenticacaoService. Por enquanto só o POST /auth/login existe; o
// cadastro, o /auth/eu e o logout estão no contrato e ainda não têm código.
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
  entrar(@Body() corpo: CorpoDoLogin): Promise<RespostaLogin> {
    return this.autenticacao.entrar(corpo);
  }
}
