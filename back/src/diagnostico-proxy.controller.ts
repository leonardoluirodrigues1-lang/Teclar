// TEMPORÁRIO — sai no commit seguinte ao ajuste do trust proxy.
//
// GET /api/diagnostico/proxy: mostra (no log e na resposta) SÓ a cadeia de
// proxies deste pedido — o X-Forwarded-For, req.ip, req.ips e o IP da conexão
// — para descobrir quantos proxies o Render põe na frente do back. Nada de
// corpo, senha ou Authorization.
//
// Protegida por um token aleatório que NÃO está no repositório: aqui fica só
// o SHA-256 dele. Sem o cabeçalho X-Diagnostico certo, 404, como uma rota que
// não existe.
import { Controller, Get, Logger, NotFoundException, Req } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const HASH_DO_TOKEN = Buffer.from('aebd0e12b6350934409bec789d47804f0244fa8644b98a0141bb76c1805075db', 'hex');

@Controller('diagnostico')
export class DiagnosticoProxyController {
  private readonly logger = new Logger('DiagnosticoProxy');

  @Get('proxy')
  proxy(@Req() requisicao: Request) {
    const token = String(requisicao.headers['x-diagnostico'] ?? '');
    const hash = createHash('sha256').update(token).digest();
    if (!token || !timingSafeEqual(hash, HASH_DO_TOKEN)) {
      throw new NotFoundException({ mensagem: 'Rota não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    const cadeia = {
      xForwardedFor: requisicao.headers['x-forwarded-for'] ?? null,
      ip: requisicao.ip,
      ips: requisicao.ips,
      conexao: requisicao.socket.remoteAddress ?? null,
    };
    this.logger.log(JSON.stringify(cadeia));
    return cadeia;
  }
}
