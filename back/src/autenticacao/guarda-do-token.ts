// guarda-do-token.ts
// O guard que protege as rotas: confere o token do cabeçalho
//   Authorization: Bearer <token>
// e, se ele vale, põe a identidade (id e tipo) em request.identidade.
//
// AINDA NÃO ESTÁ APLICADO EM ROTA NENHUMA. Quando estiver, uma rota usa assim:
//   @UseGuards(GuardaDoToken)
//   @Get('rp')
//   lerRp(@Req() req: RequisicaoComIdentidade) { ... req.identidade.id ... }
// e o módulo dela importa o AutenticacaoModule (que exporta este guard).
//
// O guard não confere se o tipo serve para a rota (conta numa rota de
// aluno): isso é 403 TIPO_INVALIDO, e quem sabe o tipo certo é a rota.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { ConteudoDoToken, Identidade } from './token.js';

// A requisição depois de passar pelo guard.
export interface RequisicaoComIdentidade extends Request {
  identidade: Identidade;
}

@Injectable()
export class GuardaDoToken implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

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
