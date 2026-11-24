// As rotas de "eu mesmo" da página Configurações > Conta (Solo, professor e
// aluno): nome, senha e foto da conta; senha e foto da matrícula do aluno. Só recebe e
// devolve: a regra está no AutenticacaoService, junto do login e do cadastro.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from './guarda-do-token.js';
import type { RequisicaoComIdentidade } from './guarda-do-token.js';
import { AutenticacaoService } from './autenticacao.service.js';
import type { Usuario } from './autenticacao.service.js';
import type { ImagemDaFoto } from '../foto.js';

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

  // A foto de perfil, só a própria. O professor lê a dos alunos dele em
  // GET /turmas/:id/alunos/:alunoId/foto (alunos.controller.ts).
  @Put('conta/foto')
  gravarFotoDaConta(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: { imagem?: unknown }): Promise<Usuario> {
    return this.autenticacao.gravarFoto(requisicao.identidade, 'conta', corpo);
  }

  @Get('conta/foto')
  fotoDaConta(@Req() requisicao: RequisicaoComIdentidade): Promise<ImagemDaFoto> {
    return this.autenticacao.foto(requisicao.identidade, 'conta');
  }

  @Delete('conta/foto')
  @HttpCode(HttpStatus.NO_CONTENT)
  apagarFotoDaConta(@Req() requisicao: RequisicaoComIdentidade): Promise<void> {
    return this.autenticacao.apagarFoto(requisicao.identidade, 'conta');
  }

  @Put('aluno/foto')
  gravarFotoDoAluno(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: { imagem?: unknown }): Promise<Usuario> {
    return this.autenticacao.gravarFoto(requisicao.identidade, 'aluno', corpo);
  }

  @Get('aluno/foto')
  fotoDoAluno(@Req() requisicao: RequisicaoComIdentidade): Promise<ImagemDaFoto> {
    return this.autenticacao.foto(requisicao.identidade, 'aluno');
  }

  @Delete('aluno/foto')
  @HttpCode(HttpStatus.NO_CONTENT)
  apagarFotoDoAluno(@Req() requisicao: RequisicaoComIdentidade): Promise<void> {
    return this.autenticacao.apagarFoto(requisicao.identidade, 'aluno');
  }
}
