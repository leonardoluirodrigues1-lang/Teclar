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

// Barreira contra sessão impossível (trapaça). Os números vêm do motor da
// tela, que roda no navegador: isto barra o impossível, NÃO prova que a
// pessoa digitou (conferir tecla a tecla no servidor fica como melhoria
// futura). Os limites:
//  - PPM_PLAUSIVEL: teto humano sustentado, ~250 PPM; acima é bot/colagem.
//  - SEGUNDOS_MINIMOS: o contrato não dá o tamanho do exercício aqui, então
//    um mínimo fixo pequeno; ninguém CONCLUI um treino real em menos.
//  - FOLGA: o PPM enviado tem de bater com o que os acertos e o tempo dão
//    (o motor calcula wpm = acertos / CARACTERES_POR_PALAVRA / minutos),
//    com margem para o arredondamento.
const PPM_PLAUSIVEL = 250;
const SEGUNDOS_MINIMOS = 3;
const FOLGA = 0.1;
// Igual ao CONFIG.TREINO.CARACTERES_POR_PALAVRA do front (js/config.ts): a
// convenção de todo teste de digitação. Se mudar lá, muda aqui.
const CARACTERES_POR_PALAVRA = 5;

// Gravados como chegaram do motor da tela: o back só confere que cabem nas
// colunas e fazem sentido (nada negativo, precisão até 100), e que a sessão
// não é fisicamente impossível (conferirPlausibilidade).
export function validarMedidas(corpo: CorpoComMedidas | undefined): MedidasValidadas {
  const medidas: MedidasValidadas = {
    WPM: numeroEntre(corpo?.wpm, 'wpm', PPM_MAXIMO),
    Precisao: numeroEntre(corpo?.precisao, 'precisao', PRECISAO_MAXIMA),
    Acertos: inteiroNaoNegativo(corpo?.acertos, 'acertos'),
    Erros: inteiroNaoNegativo(corpo?.erros, 'erros'),
    Tempo_Gasto_Segundos: inteiroNaoNegativo(corpo?.tempo_gasto_segundos, 'tempo_gasto_segundos'),
    Concluida: booleano(corpo?.concluida, 'concluida'),
  };
  conferirPlausibilidade(medidas);
  return medidas;
}

function conferirPlausibilidade(m: MedidasValidadas): void {
  // (a) Concluir leva tempo: uma sessão concluída em menos que o mínimo é
  // impossível (abandonada curtíssima é legítima, e fica de fora).
  if (m.Concluida && m.Tempo_Gasto_Segundos < SEGUNDOS_MINIMOS) {
    throw dadosInvalidos(`Uma sessão concluída leva pelo menos ${SEGUNDOS_MINIMOS} segundos.`);
  }
  // (b) Teto humano.
  if (m.WPM > PPM_PLAUSIVEL) {
    throw dadosInvalidos(`wpm acima do humanamente plausível (máximo ${PPM_PLAUSIVEL}).`);
  }
  // (c) O PPM tem de bater com os acertos e o tempo. Só dá para conferir
  // com tempo ≥ 1 s: abaixo disso o tempo, que vem arredondado em segundos
  // inteiros, torna a conta sem sentido, e o teto (b) já barra o absurdo.
  const t = m.Tempo_Gasto_Segundos;
  if (t >= 1) {
    // O motor arredonda o tempo para segundos, então o tempo real está em
    // [t-0,5; t+0,5): o PPM coerente cai numa faixa, não num ponto.
    const porMinuto = (m.Acertos / CARACTERES_POR_PALAVRA) * 60;
    const maisAlto = porMinuto / (t - 0.5);
    const maisBaixo = porMinuto / (t + 0.5);
    if (m.WPM > maisAlto * (1 + FOLGA) || m.WPM < maisBaixo * (1 - FOLGA)) {
      throw dadosInvalidos('wpm não bate com os acertos e o tempo informados.');
    }
  }
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
