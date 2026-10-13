// parametros.service.ts
// Os parâmetros globais (tabela Configuracoes), no grupo "Administração"
// do CONTRATO-API.md:
//   GET /parametros   os quatro valores — qualquer token válido (o lobby
//                     do Solo lê o xpPorNivel para desenhar a barra de XP)
//   PUT /parametros   muda só os campos enviados — só administrador
//
// A tabela é chave/valor, com o valor em texto (VARCHAR). Aqui ela vira o
// objeto Parametros do front, com nomes nossos e números de verdade.
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { exigirAdministrador } from './administrador-do-token.js';

// A forma do tipo Parametros do front (js/nucleo/tipos.ts).
export interface Parametros {
  wpmMeta: number;
  precisaoMinima: number;
  tempoLimitePadrao: number;
  xpPorNivel: number;
}

type NomeDoParametro = keyof Parametros;

// Cada campo da resposta, a chave dele em Configuracoes e a faixa que ele
// aceita no PUT. O contrato não traz faixa; foram escolhidas assim:
//   wpmMeta            1 a 999   cabe na coluna de PPM (DECIMAL(5,2)); meta 0 não é meta
//   precisaoMinima     0 a 100   é porcentagem
//   tempoLimitePadrao  0 a 3600  o mesmo limite do tempo de exercício
//                                (LIMITES.EXERCICIO_TEMPO_MAX no front); 0 = sem limite
//   xpPorNivel         1 para cima   é divisor do nível: 0 quebraria a conta
const PARAMETROS: Record<NomeDoParametro, { chave: string; minimo: number; maximo: number }> = {
  wpmMeta: { chave: 'wpm_meta_padrao', minimo: 1, maximo: 999 },
  precisaoMinima: { chave: 'precisao_minima', minimo: 0, maximo: 100 },
  tempoLimitePadrao: { chave: 'tempo_limite_padrao_segundos', minimo: 0, maximo: 3600 },
  xpPorNivel: { chave: 'xp_por_nivel', minimo: 1, maximo: 2147483647 },
};

@Injectable()
export class ParametrosService {
  constructor(private readonly banco: BancoService) {}

  // GET /parametros.
  async ler(): Promise<Parametros> {
    const linhas = await this.banco.configuracoes.findMany();
    const valorDe = (nome: NomeDoParametro): number => {
      const linha = linhas.find((l) => l.Chave === PARAMETROS[nome].chave);
      // Sem a linha, o banco está incompleto (o .sql semeia as quatro):
      // melhor um erro claro do que um número inventado aqui.
      if (!linha) {
        throw new Error(`Configuracoes.${PARAMETROS[nome].chave} não existe. Veja o DB_Teclar_v9.sql.`);
      }
      return Number(linha.Valor);
    };
    return {
      wpmMeta: valorDe('wpmMeta'),
      precisaoMinima: valorDe('precisaoMinima'),
      tempoLimitePadrao: valorDe('tempoLimitePadrao'),
      xpPorNivel: valorDe('xpPorNivel'),
    };
  }

  // PUT /parametros. Só os campos enviados mudam (Partial<Parametros>).
  // Primeiro o papel (404 para quem não é administrador), depois TODOS os
  // campos são conferidos, e só então tudo é gravado, numa transação: um
  // campo inválido não deixa os outros meio gravados.
  async salvar(identidade: Identidade, corpo: unknown): Promise<Parametros> {
    await exigirAdministrador(this.banco, identidade);
    const mudancas = validarMudancas(corpo);
    await this.banco.$transaction(
      mudancas.map(([nome, valor]) =>
        this.banco.configuracoes.update({ where: { Chave: PARAMETROS[nome].chave }, data: { Valor: String(valor) } }),
      ),
    );
    return this.ler();
  }
}

// O corpo vira a lista de [campo, valor] a gravar. Campo que não é um dos
// quatro é recusado com 400, e não ignorado: quem mandou "xpNivel" (com
// erro de digitação) acharia que mudou o XP por nível.
function validarMudancas(corpo: unknown): [NomeDoParametro, number][] {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw dadosInvalidos('Mande um objeto com os parâmetros que mudam.');
  }
  const mudancas: [NomeDoParametro, number][] = [];
  for (const [campo, valor] of Object.entries(corpo)) {
    // Object.hasOwn, e não `in`: com `in`, "toString" passaria (vem do
    // protótipo de todo objeto).
    if (!Object.hasOwn(PARAMETROS, campo)) {
      throw dadosInvalidos(`Parâmetro desconhecido: ${campo}.`);
    }
    const nome = campo as NomeDoParametro;
    const { minimo, maximo } = PARAMETROS[nome];
    if (!Number.isInteger(valor) || (valor as number) < minimo || (valor as number) > maximo) {
      throw dadosInvalidos(`${nome} precisa ser um número inteiro de ${minimo} a ${maximo}.`);
    }
    mudancas.push([nome, valor as number]);
  }
  return mudancas;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
