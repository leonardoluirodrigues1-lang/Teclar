// As rotas de "eu mesmo" da página Configurações > Conta (Solo, professor e
// aluno): nome e senha da conta, senha da matrícula do aluno. Só recebe e
// devolve: a regra está no AutenticacaoService, junto do login e do cadastro.
import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from './guarda-do-token.js';
import type { RequisicaoComIdentidade } from './guarda-do-token.js';
import { AutenticacaoService } from './autenticacao.service.js';
import type { Usuario } from './autenticacao.service.js';

interface CorpoDaTrocaDeSenha {
  senhaAtual?: unknown;
  novaSenha?: unknown;
}

@Controller()
@UseGuards(GuardaDoToken)
export class PerfilController {
  constructor(private readonly autenticacao: AutenticacaoService) {}

  @Patch('conta')
  renomear(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: { nome?: unknown }): Promise<Usuario> {
    return this.autenticacao.renomearConta(requisicao.identidade, corpo);
  }

  @Post('conta/senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  trocarSenhaDaConta(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDaTrocaDeSenha): Promise<void> {
    return this.autenticacao.trocarSenhaDaConta(requisicao.identidade, corpo);
  }

  // PUT, e não o POST /aluno/senha: aquele é o "Crie sua senha" da
  // provisória (sem senha atual) e continua recusando quem já tem senha.
  @Put('aluno/senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  trocarSenhaDoAluno(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDaTrocaDeSenha): Promise<void> {
    return this.autenticacao.trocarSenhaDoAluno(requisicao.identidade, corpo);
  }
}
