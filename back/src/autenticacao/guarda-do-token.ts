// O guard que protege as rotas: confere o token do cabeçalho
//   Authorization: Bearer <token>
// e, se ele vale, põe a identidade (id e tipo) em request.identidade.
//
// A primeira rota que o usa é o GET /auth/eu (autenticacao.controller.ts).
// Uma rota de outro módulo usa assim:
//   @UseGuards(GuardaDoToken)
//   @Get('rp')
//   lerRp(@Req() req: RequisicaoComIdentidade) { ... req.identidade.id ... }
// e o módulo dela importa o AutenticacaoModule (que exporta este guard).
//
// O guard não confere se o tipo serve para a rota (conta numa rota de
// aluno): isso é 403 TIPO_INVALIDO, e quem sabe o tipo certo é a rota.
//
// Confere uma coisa do aluno: quem entrou com a senha provisória e ainda
// não criou a dele (SenhaHash NULL) só passa nas rotas marcadas com
// @PermitidoSemSenha() (GET /auth/eu e POST /aluno/senha); nas outras, 403
// TROCAR_SENHA. O logout é público e nem passa por aqui.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { BancoService } from '../banco/banco.service.js';
import type { ConteudoDoToken, Identidade } from './token.js';

const PERMITIDO_SEM_SENHA = 'permitidoSemSenha';

/** A rota abre também para o aluno que ainda não criou a senha dele. */
export const PermitidoSemSenha = () => SetMetadata(PERMITIDO_SEM_SENHA, true);

// A requisição depois de passar pelo guard.
export interface RequisicaoComIdentidade extends Request {
  identidade: Identidade;
}

@Injectable()
export class GuardaDoToken implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly banco: BancoService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoComIdentidade>();
    const token = tokenDoCabecalho(requisicao);
    if (!token) {
      throw tokenInvalido();
    }

    // verifyAsync confere a assinatura (com o JWT_SEGREDO) e a validade.
    // Qualquer falha — assinatura errada, token vencido, texto que nem é
    // JWT — vira o mesmo 401: a tela só precisa saber que tem de entrar de novo.
    let conteudo: ConteudoDoToken;
    try {
      conteudo = await this.jwt.verifyAsync<ConteudoDoToken>(token);
    } catch {
      throw tokenInvalido();
    }

    requisicao.identidade = { id: conteudo.sub, tipo: conteudo.tipo };

    if (conteudo.tipo === 'aluno' && !this.reflector.get<boolean>(PERMITIDO_SEM_SENHA, contexto.getHandler())) {
      const aluno = await this.banco.alunosturmas.findUnique({
        where: { AlunoID: conteudo.sub },
        select: { SenhaHash: true },
      });
      // Aluno que sumiu segue: a rota responde o 401/404 dela.
      if (aluno && aluno.SenhaHash === null) {
        throw new ForbiddenException({ mensagem: 'Crie a sua senha antes de continuar.', codigo: 'TROCAR_SENHA' });
      }
    }
    return true;
  }
}

// "Bearer abc.def.ghi" -> "abc.def.ghi". Qualquer outro formato -> null.
function tokenDoCabecalho(requisicao: Request): string | null {
  const cabecalho = requisicao.headers.authorization ?? '';
  const [esquema, token] = cabecalho.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

// O erro do contrato para token ausente, vencido ou inválido.
function tokenInvalido(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Token inválido ou expirado.', codigo: 'TOKEN_INVALIDO' });
}
