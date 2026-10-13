// progresso.service.ts
// O progresso do jogador no Solo, no grupo "Solo" do CONTRATO-API.md:
//   POST /solo/sessoes        grava um treino e dá o XP
//   GET  /solo/historico      as sessões da campanha
//   GET  /solo/indicadores    nível, XP, médias e melhor PPM
//   GET  /solo/estatisticas   lições concluídas e o melhor de cada lição
//
// Tudo da campanha DO TOKEN: nenhuma rota recebe id de campanha.
//
// O PROGRESSO NUNCA REGRIDE. Cada treino vira uma linha nova em
// SessionsSolo, e nenhuma rota apaga ou reescreve sessão; o XP só soma; e
// "lição concluída", "melhor PPM" e "melhor precisão" são calculados sobre
// TODAS as sessões (a lição conta se ALGUMA sessão nela foi concluída; a
// marca é a maior de todas). Refazer uma lição pior acrescenta uma linha,
// mas não apaga a melhor nem tira a lição da lista das concluídas.
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Paginado } from '../relatorios/relatorios.service.js';
import { validarMedidas } from '../sessoes/medidas-da-sessao.js';
import type { CorpoComMedidas } from '../sessoes/medidas-da-sessao.js';
import { mediaInteira } from '../sessoes/sessao-escola.js';
import { sessaoSoloNaForma } from '../sessoes/sessoes.service.js';
import type { SessaoSolo } from '../sessoes/sessoes.service.js';
import { campanhaDoToken, jogadorDoToken } from './campanha-do-token.js';
import { nivelDoXp, xpDaSessao } from './xp.js';

// O corpo do POST como chega (DadosSessaoTreino no contrato): a lição e as
// medidas do motor. Os ids de pessoa e de campanha só existem aqui para
// serem RECUSADOS.
export interface CorpoDaSessaoSolo extends CorpoComMedidas {
  exercicio_id?: unknown;
  campanha_id?: unknown;
  jogadorId?: unknown;
  usuario_id?: unknown;
  alunoId?: unknown;
  professorId?: unknown;
}

export interface RespostaSessaoSolo {
  id: string;
  xpGanho: number;
  xpTotal: number;
  nivelAtual: number;
  subiuDeNivel: boolean;
  recordePessoal: boolean;
}

export interface IndicadoresSolo {
  campanhaId: string;
  nivelAtual: number;
  xpTotal: number;
  sessoesTotais: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  melhorWpm: number | null;
}

// Uma linha de porLicao (DesempenhoLicaoSolo no front).
export interface DesempenhoLicaoSolo {
  exerciseId: string;
  titulo: string;
  nivel: number;
  tentativas: number;
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  ultimaVez: string;
}

export interface EstatisticasSolo {
  campanhaId: string;
  licoesConcluidas: number;
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  porLicao: DesempenhoLicaoSolo[];
}

// Os campos que diriam DE QUEM é a sessão. A campanha sai do token: com
// campanha_id no corpo, dava para gravar XP na campanha de outro jogador.
// Recusados com 400, e não ignorados, para quem mandou não achar que
// escolheu a campanha.
const CAMPOS_DE_IDENTIDADE = ['campanha_id', 'jogadorId', 'usuario_id', 'alunoId', 'professorId'] as const;

// A chave da tabela Configuracoes com o XP de cada nível (200 no banco v9).
const CHAVE_XP_POR_NIVEL = 'xp_por_nivel';

@Injectable()
export class ProgressoService {
  constructor(private readonly banco: BancoService) {}

  // POST /solo/sessoes. A ordem das conferências é a do POST /sessoes:
  // primeiro quem pede (403), depois o corpo (400), e só então a campanha
  // e a lição (404) — um 404 nunca sai para um corpo que nem seria aceito.
  async registrar(identidade: Identidade, corpo: CorpoDaSessaoSolo): Promise<RespostaSessaoSolo> {
    jogadorDoToken(identidade);
    recusarIdentidadeNoCorpo(corpo);
    const licaoId = licaoDoCorpo(corpo?.exercicio_id);
    const medidas = validarMedidas(corpo);
    const campanha = await campanhaDoToken(this.banco, identidade);
    await this.exigirLicao(licaoId);

    const melhorAntes = await this.melhorPpmAnterior(campanha.CampanhaID, licaoId);
    const xpGanho = xpDaSessao(medidas.Concluida, medidas.Precisao);
    const xpPorNivel = await this.lerXpPorNivel();
    const nivelAntes = campanha.NivelAtual ?? 1;

    // A sessão e o XP numa transação: ou os dois ficam, ou nenhum. O XP soma
    // com increment (UPDATE ... SET XPTotal = XPTotal + ?), e não com o
    // valor lido antes: duas sessões gravadas ao mesmo tempo não perdem XP.
    const { sessao, xpTotal, nivelAtual } = await this.banco.$transaction(async (tx) => {
      const gravada = await tx.sessionssolo.create({
        data: { ID: randomUUID(), CampanhaID: campanha.CampanhaID, ExerciseID: licaoId, XPGanho: xpGanho, ...medidas },
      });
      const comXp = await tx.campanhassolo.update({
        where: { CampanhaID: campanha.CampanhaID },
        data: { XPTotal: { increment: xpGanho } },
      });
      const xpNovo = comXp.XPTotal ?? xpGanho;
      const nivelNovo = nivelDoXp(xpNovo, xpPorNivel);
      await tx.campanhassolo.update({ where: { CampanhaID: campanha.CampanhaID }, data: { NivelAtual: nivelNovo } });
      return { sessao: gravada, xpTotal: xpNovo, nivelAtual: nivelNovo };
    });

    return {
      // O id abre a tela de resultado (?sessao=<id>).
      id: sessao.ID,
      xpGanho,
      xpTotal,
      nivelAtual,
      subiuDeNivel: nivelAtual > nivelAntes,
      // Recorde = PPM maior que o melhor anterior NESTA lição. Na primeira
      // vez o "melhor anterior" é 0, como no POST /sessoes da Escola.
      recordePessoal: medidas.WPM > melhorAntes,
    };
  }

  // GET /solo/historico. Todas as sessões da campanha, da mais antiga para
  // a mais recente (a ordem em que o mock as devolve, e a que a tela usa
  // para desenhar a evolução). O contrato não define tamanho de página: vem
  // tudo, com pagina = 1, como no GET /exercicios. Os filtros que o
  // contrato diz aceitar não têm nome definido e nenhuma tela manda: a
  // query é ignorada.
  async historico(identidade: Identidade): Promise<Paginado<SessaoSolo>> {
    const campanha = await campanhaDoToken(this.banco, identidade);
    const linhas = await this.banco.sessionssolo.findMany({
      where: { CampanhaID: campanha.CampanhaID },
      orderBy: { Data_Sessao: 'asc' },
    });
    const itens = linhas.map(sessaoSoloNaForma);
    return { total: itens.length, pagina: 1, itens };
  }

  // GET /solo/indicadores. Médias só das sessões CONCLUÍDAS, inteiras, e
  // null sem nenhuma (nunca 0). melhorWpm olha todas: o PPM que ele fez na
  // sessão que não terminou também foi dele.
  async indicadores(identidade: Identidade): Promise<IndicadoresSolo> {
    const campanha = await campanhaDoToken(this.banco, identidade);
    const sessoes = (await this.sessoesDaCampanha(campanha.CampanhaID)).map(sessaoSoloNaForma);
    const concluidas = sessoes.filter((sessao) => sessao.concluida);
    return {
      campanhaId: campanha.CampanhaID,
      nivelAtual: campanha.NivelAtual ?? 1,
      xpTotal: campanha.XPTotal ?? 0,
      sessoesTotais: sessoes.length,
      wpmMedio: mediaInteira(concluidas.map((sessao) => sessao.wpm)),
      precisaoMedia: mediaInteira(concluidas.map((sessao) => sessao.precisao)),
      melhorWpm: maiorOuNull(sessoes.map((sessao) => sessao.wpm)),
    };
  }

  // GET /solo/estatisticas. Nível e XP não vêm aqui (são de /solo/campanha);
  // sequência de dias e evolução a tela deriva do histórico.
  async estatisticas(identidade: Identidade): Promise<EstatisticasSolo> {
    const campanha = await campanhaDoToken(this.banco, identidade);
    const linhas = await this.banco.sessionssolo.findMany({
      where: { CampanhaID: campanha.CampanhaID },
      // O JOIN em ExerciciosSolo, para título e nível de cada lição.
      include: { exerciciossolo: { select: { Titulo: true, Nivel: true, Ordem: true } } },
      orderBy: [{ exerciciossolo: { Ordem: 'asc' } }, { Data_Sessao: 'asc' }],
    });
    const sessoes = linhas.map(sessaoSoloNaForma);
    return {
      campanhaId: campanha.CampanhaID,
      // Lições DISTINTAS com pelo menos uma sessão concluída.
      licoesConcluidas: new Set(sessoes.filter((s) => s.concluida).map((s) => s.exerciseId)).size,
      melhorWpm: maiorOuNull(sessoes.map((sessao) => sessao.wpm)),
      melhorPrecisao: maiorOuNull(sessoes.map((sessao) => sessao.precisao)),
      porLicao: agruparPorLicao(linhas),
    };
  }

  private sessoesDaCampanha(campanhaId: string) {
    return this.banco.sessionssolo.findMany({ where: { CampanhaID: campanhaId } });
  }

  // Lição desativada (Ativo = false) não recebe sessão nova, como o
  // exercício arquivado na Escola; as sessões antigas nela ficam.
  private async exigirLicao(licaoId: string): Promise<void> {
    const licao = await this.banco.exerciciossolo.findFirst({ where: { ExerciseID: licaoId, Ativo: true } });
    if (!licao) {
      throw new NotFoundException({ mensagem: 'Lição não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
  }

  // O maior PPM que o jogador já fez nesta lição (concluída ou não, como no
  // POST /sessoes da Escola); 0 se nunca fez.
  private async melhorPpmAnterior(campanhaId: string, licaoId: string): Promise<number> {
    const resultado = await this.banco.sessionssolo.aggregate({
      where: { CampanhaID: campanhaId, ExerciseID: licaoId },
      _max: { WPM: true },
    });
    return Number(resultado._max.WPM ?? 0);
  }

  // O XP de cada nível sai da tabela Configuracoes, o mesmo número que
  // GET /parametros devolve à tela (o lobby desenha a barra de XP com ele).
  // Sem a linha, o banco está incompleto: melhor um erro claro do que um
  // nível calculado com um número inventado aqui.
  private async lerXpPorNivel(): Promise<number> {
    const linha = await this.banco.configuracoes.findUnique({ where: { Chave: CHAVE_XP_POR_NIVEL } });
    const valor = Number(linha?.Valor);
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new Error(`Configuracoes.${CHAVE_XP_POR_NIVEL} ausente ou inválido. Veja o DB_Teclar_v9.sql.`);
    }
    return valor;
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

type SessaoComLicao = Prisma.sessionssoloGetPayload<{
  include: { exerciciossolo: { select: { Titulo: true; Nivel: true; Ordem: true } } };
}>;

// Uma linha por lição TENTADA (lição nunca tentada não aparece), na ordem
// do percurso. As linhas já chegam ordenadas pela lição e, dentro dela,
// pela data, então a última vista de cada lição é a mais recente.
function agruparPorLicao(linhas: SessaoComLicao[]): DesempenhoLicaoSolo[] {
  const porLicao = new Map<string, DesempenhoLicaoSolo>();
  for (const linha of linhas) {
    const sessao = sessaoSoloNaForma(linha);
    const atual = porLicao.get(sessao.exerciseId);
    if (!atual) {
      porLicao.set(sessao.exerciseId, {
        exerciseId: sessao.exerciseId,
        titulo: linha.exerciciossolo.Titulo,
        nivel: linha.exerciciossolo.Nivel,
        tentativas: 1,
        melhorWpm: sessao.wpm,
        melhorPrecisao: sessao.precisao,
        ultimaVez: sessao.data,
      });
      continue;
    }
    // A melhor marca é o MÁXIMO: uma tentativa pior não a rebaixa.
    atual.tentativas += 1;
    atual.melhorWpm = Math.max(atual.melhorWpm ?? 0, sessao.wpm);
    atual.melhorPrecisao = Math.max(atual.melhorPrecisao ?? 0, sessao.precisao);
    atual.ultimaVez = sessao.data;
  }
  return [...porLicao.values()];
}

// O maior número, ou null sem nenhum (nunca 0: zero seria uma marca).
function maiorOuNull(numeros: number[]): number | null {
  return numeros.length === 0 ? null : Math.max(...numeros);
}

function recusarIdentidadeNoCorpo(corpo: CorpoDaSessaoSolo | undefined): void {
  for (const campo of CAMPOS_DE_IDENTIDADE) {
    if (corpo?.[campo] !== undefined) {
      throw dadosInvalidos(`A campanha sai do login: não mande ${campo}.`);
    }
  }
}

function licaoDoCorpo(valor: unknown): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw dadosInvalidos('Informe exercicio_id.');
  }
  return valor;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
