// tentativas-de-login.ts
// Conta as senhas erradas do POST /auth/login por IP + identidade (ver
// AutenticacaoService.entrar). Com 5 falhas no mesmo minuto, as próximas
// tentativas dessa chave — até com a senha certa — dão 429
// MUITAS_TENTATIVAS até o minuto passar; um login certo zera a contagem.
//
// Só a falha conta: o objetivo é barrar quem chuta senha sem punir quem
// entra certo (o professor que entra e sai várias vezes, a turma inteira
// entrando no começo da aula pelo mesmo IP da escola).
//
// Em memória porque o back roda numa instância só (no Render). Se um dia
// houver várias instâncias, cada uma teria a sua contagem: aí isto precisa
// ir para o banco ou para um Redis.
import { Injectable } from '@nestjs/common';
import { muitasTentativas } from '../limite-de-tentativas.js';

const MAXIMO_DE_FALHAS = 5;
const JANELA = 60_000;

interface Falhas {
  quantas: number;
  // O minuto conta da primeira falha.
  venceEm: number;
}

@Injectable()
export class TentativasDeLogin {
  private readonly falhas = new Map<string, Falhas>();

  // Chamado antes de conferir a senha: chave bloqueada nem chega no banco.
  conferir(chave: string): void {
    const registro = this.falhas.get(chave);
    if (registro && registro.venceEm > Date.now() && registro.quantas >= MAXIMO_DE_FALHAS) {
      throw muitasTentativas();
    }
  }

  somarFalha(chave: string): void {
    const agora = Date.now();
    // Limpar antes de ler: assim a chave com o minuto vencido recomeça do zero.
    this.limparVencidas(agora);
    const registro = this.falhas.get(chave) ?? { quantas: 0, venceEm: agora + JANELA };
    registro.quantas++;
    this.falhas.set(chave, registro);
  }

  zerar(chave: string): void {
    this.falhas.delete(chave);
  }

  // Sem isto o Map só cresceria: toda chave que errou uma vez ficaria nele.
  private limparVencidas(agora: number): void {
    for (const [chave, registro] of this.falhas) {
      if (registro.venceEm <= agora) {
        this.falhas.delete(chave);
      }
    }
  }
}
