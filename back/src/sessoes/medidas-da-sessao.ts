// medidas-da-sessao.ts
// O pacote que o motor de digitação da tela manda ao fim de um treino
// (wpm, precisao, acertos, erros, tempo_gasto_segundos, concluida), e a
// conferência dele. Serve aos dois mundos: POST /sessoes (Escola) e
// POST /solo/sessoes (Solo) recebem o mesmo pacote (DadosSessaoTreino no
// contrato) e gravam nas mesmas colunas, então conferem do mesmo jeito.
import { BadRequestException } from '@nestjs/common';

// O pacote como chega da rede: tudo unknown, porque um curl pode mandar
// qualquer coisa.
export interface CorpoComMedidas {
  wpm?: unknown;
  precisao?: unknown;
  acertos?: unknown;
  erros?: unknown;
  tempo_gasto_segundos?: unknown;
  concluida?: unknown;
}

// O pacote já conferido, com os nomes das colunas de SessionsProf e
// SessionsSolo (as duas têm as mesmas seis).
export interface MedidasValidadas {
  WPM: number;
  Precisao: number;
  Acertos: number;
  Erros: number;
  Tempo_Gasto_Segundos: number;
  Concluida: boolean;
}

// O contrato não traz limite para os números do motor, e os LIMITES do
// front não falam de sessão. Os limites abaixo são os das colunas: WPM e
// Precisao são DECIMAL(5,2) (até 999,99) e os outros são INT. Passar disso
// seria erro 500 no INSERT, em vez de 400.
const PPM_MAXIMO = 999.99;
const PRECISAO_MAXIMA = 100;
const MAIOR_INT = 2147483647;

// Gravados como chegaram do motor da tela: o back só confere que cabem nas
// colunas e fazem sentido (nada negativo, precisão até 100).
export function validarMedidas(corpo: CorpoComMedidas | undefined): MedidasValidadas {
  return {
    WPM: numeroEntre(corpo?.wpm, 'wpm', PPM_MAXIMO),
    Precisao: numeroEntre(corpo?.precisao, 'precisao', PRECISAO_MAXIMA),
    Acertos: inteiroNaoNegativo(corpo?.acertos, 'acertos'),
    Erros: inteiroNaoNegativo(corpo?.erros, 'erros'),
    Tempo_Gasto_Segundos: inteiroNaoNegativo(corpo?.tempo_gasto_segundos, 'tempo_gasto_segundos'),
    Concluida: booleano(corpo?.concluida, 'concluida'),
  };
}

function numeroEntre(valor: unknown, campo: string, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw dadosInvalidos(`${campo} precisa ser um número de 0 a ${maximo}.`);
  }
  return valor;
}

function inteiroNaoNegativo(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0 || valor > MAIOR_INT) {
    throw dadosInvalidos(`${campo} precisa ser um número inteiro, de 0 para cima.`);
  }
  return valor;
}

function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') {
    throw dadosInvalidos(`${campo} precisa ser true ou false.`);
  }
  return valor;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
