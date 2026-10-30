// limite-de-tentativas.ts
// Limite geral de requisições por IP (@nestjs/throttler), aplicado a todas
// as rotas pelo AppModule. As senhas erradas do login têm um contador
// próprio, mais apertado (autenticacao/tentativas-de-login.ts).
//
// A contagem fica na memória do processo: reiniciar o back zera tudo.
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Folgado: uma turma de ~30 alunos divide o mesmo IP da escola, e cada
// tela faz algumas chamadas por vez. Isto só barra script em laço.
export const LIMITE_GERAL = { ttl: 60_000, limit: 1000 };

// O mesmo 429 para os dois limites, no corpo de erro do contrato.
export function muitasTentativas(): HttpException {
  return new HttpException(
    { mensagem: 'Muitas tentativas. Espere um minuto e tente de novo.', codigo: 'MUITAS_TENTATIVAS' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

// O ThrottlerGuard padrão responde { statusCode, message } em inglês; aqui
// o 429 sai como o das outras rotas.
@Injectable()
export class GuardaDoLimite extends ThrottlerGuard {
  protected override throwThrottlingException(): Promise<void> {
    throw muitasTentativas();
  }
}
