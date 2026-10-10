// alunos.service.ts
// A regra do grupo "Alunos (professor)" do CONTRATO-API.md: o professor
// administrando a lista de UMA turma dele.
//   GET    /turmas/:turmaId/alunos                         a lista, com agregados
//   POST   /turmas/:turmaId/alunos/importar                a única entrada do aluno
//   DELETE /turmas/:turmaId/alunos/:alunoId                remove (e leva as sessões)
//   POST   /turmas/:turmaId/alunos/:alunoId/zerar-senha    volta ao primeiro acesso
//   GET    /turmas/:turmaId/alunos/:alunoId/desempenho     agregados e sessões
//
// A turma tem de ser da conta do token (senão 404). O :alunoId é o
// aluno-ALVO, e só vale dentro da :turmaId: aluno de outra turma, mesmo da
// mesma conta, é 404. Quem pede continua saindo do token.
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { professorDoToken, recusarProfessorIdNoCorpo } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { turmaDaConta } from '../turmas/turma-da-conta.js';

// O corpo do importar como chega: tudo unknown, vem da rede.
export interface CorpoDaImportacao {
  nomes?: unknown;
  professorId?: unknown;
}

// Um aluno na forma do tipo Aluno do front (js/nucleo/tipos.ts). A senha
// nunca sai: só senhaDefinida.
export interface Aluno {
  id: string;
  nome: string;
  entrouEm: string;
  senhaDefinida: boolean;
  totalSessoes: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  ultimaAtividade: string | null;
}

export interface ResultadoImportacao {
  adicionados: Aluno[];
  jaEstavam: string[];
  falhas: { nome: string; motivo: string }[];
}

// Uma sessão do mundo Escola, na forma do tipo Sessao do front.
export interface Sessao {
  id: string;
  exerciseId: string;
  alunoId: string;
  wpm: number;
  precisao: number;
  tempoSegundos: number;
  acertos: number;
  erros: number;
  concluida: boolean;
  data: string;
}

export interface DesempenhoAluno {
  alunoId: string;
  totalSessoes: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  sessoes: Sessao[];
}

// Os agregados de um aluno, como a lista e o importar devolvem.
interface Agregados {
  totalSessoes: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  ultimaAtividade: string | null;
}

// Quem nunca treinou: médias null, nunca 0 (zero diria "treinou e fez 0 PPM").
const SEM_SESSOES: Agregados = { totalSessoes: 0, wpmMedio: null, precisaoMedia: null, ultimaAtividade: null };

// A tela lê o CSV e manda os nomes numa requisição só; o teto evita que um
// arquivo errado (uma planilha inteira) vire milhares de INSERTs.
const MAXIMO_DE_NOMES = 500;

// Alunos.Nome é VARCHAR(150). O mínimo é o mesmo do cadastro de conta.
const NOME_MINIMO = 2;
const NOME_MAXIMO = 150;

@Injectable()
export class AlunosService {
  constructor(private readonly banco: BancoService) {}

  // GET /turmas/:turmaId/alunos. Só os ativos, em ordem alfabética.
  async listar(identidade: Identidade, turmaId: string): Promise<Aluno[]> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);

    const alunos = await this.banco.alunos.findMany({
      where: { ClassID: turmaId, Ativo: true },
      orderBy: { Nome: 'asc' },
    });
    const agregados = await this.agregadosDaTurma(turmaId);
    return alunos.map((aluno) => alunoNaForma(aluno, agregados.get(aluno.ID) ?? SEM_SESSOES));
  }

  // POST /turmas/:turmaId/alunos/importar. Importação parcial vale: cada
  // nome cai numa de três listas, e uma falha não desfaz as outras.
  async importar(identidade: Identidade, turmaId: string, corpo: CorpoDaImportacao): Promise<ResultadoImportacao> {
    const professorId = professorDoToken(identidade);
    recusarProfessorIdNoCorpo(corpo);
    const nomes = corpo?.nomes;
    if (!Array.isArray(nomes) || nomes.length > MAXIMO_DE_NOMES) {
      throw dadosInvalidos(`Mande de 0 a ${MAXIMO_DE_NOMES} nomes numa lista.`);
    }
    await turmaDaConta(this.banco, professorId, turmaId);

    const resultado: ResultadoImportacao = { adicionados: [], jaEstavam: [], falhas: [] };
    // Os nomes já gravados na turma, pela chave de comparação. Inclui os
    // inativos: o UNIQUE (ClassID, Nome) do banco também os inclui.
    const naTurma = await this.nomesDaTurma(turmaId);
    const vistosNaLista = new Set<string>();

    for (const bruto of nomes) {
      // Item que não é texto (número, objeto, null) não vira aluno: sem
      // isto, { } seria gravado como "[object Object]".
      if (typeof bruto !== 'string') {
        resultado.falhas.push({ nome: JSON.stringify(bruto) ?? '', motivo: 'O nome precisa ser um texto.' });
        continue;
      }
      const nome = normalizarNome(bruto);
      const problema = problemaNoNome(nome);
      if (problema !== null) {
        resultado.falhas.push({ nome: bruto, motivo: problema });
        continue;
      }
      const chave = chaveDoNome(nome);
      if (vistosNaLista.has(chave)) {
        resultado.falhas.push({ nome: bruto, motivo: 'Nome repetido na lista.' });
        continue;
      }
      vistosNaLista.add(chave);

      const gravado = naTurma.get(chave);
      if (gravado !== undefined) {
        resultado.jaEstavam.push(gravado);
        continue;
      }
      await this.adicionar(turmaId, nome, resultado);
    }
    return resultado;
  }

  // DELETE /turmas/:turmaId/alunos/:alunoId. Apaga a linha de Alunos, e o
  // MySQL apaga as sessões dele junto (SessionsProf.AlunoID tem ON DELETE
  // CASCADE). Ele deixa de conseguir entrar na hora: o login não acha mais
  // o nome. Se for importado de novo, volta como linha nova, sem senha nem
  // histórico.
  async remover(identidade: Identidade, turmaId: string, alunoId: string): Promise<void> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    await this.alunoDaTurma(turmaId, alunoId);
    await this.banco.alunos.delete({ where: { ID: alunoId } });
  }

  // POST /turmas/:turmaId/alunos/:alunoId/zerar-senha. O aluno não tem
  // e-mail, então não existe "esqueci a senha" automático: é assim que o
  // professor o desbloqueia. Com SenhaHash NULL, o próximo login vira
  // primeiro acesso e grava a senha nova; o histórico fica. Zerar quem já
  // está sem senha não é erro.
  async zerarSenha(identidade: Identidade, turmaId: string, alunoId: string): Promise<void> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    await this.alunoDaTurma(turmaId, alunoId);
    await this.banco.alunos.update({ where: { ID: alunoId }, data: { SenhaHash: null } });
  }

  // GET /turmas/:turmaId/alunos/:alunoId/desempenho. Os agregados saem da
  // mesma lista de sessões que vai na resposta, para os números baterem.
  async desempenho(identidade: Identidade, turmaId: string, alunoId: string): Promise<DesempenhoAluno> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    await this.alunoDaTurma(turmaId, alunoId);

    const linhas = await this.banco.sessionsprof.findMany({
      where: { AlunoID: alunoId, ClassID: turmaId },
      orderBy: { Data_Sessao: 'asc' },
    });
    const sessoes = linhas.map(sessaoNaForma);
    const concluidas = sessoes.filter((sessao) => sessao.concluida);
    return {
      alunoId,
      totalSessoes: sessoes.length,
      wpmMedio: mediaInteira(concluidas.map((sessao) => sessao.wpm)),
      precisaoMedia: mediaInteira(concluidas.map((sessao) => sessao.precisao)),
      sessoes,
    };
  }

  // O aluno, só se for desta turma. De outra turma é o mesmo 404 de aluno
  // que não existe.
  private async alunoDaTurma(turmaId: string, alunoId: string) {
    const aluno = await this.banco.alunos.findFirst({ where: { ID: alunoId, ClassID: turmaId } });
    if (!aluno) {
      throw new NotFoundException({ mensagem: 'Aluno não encontrado nesta turma.', codigo: 'NAO_ENCONTRADO' });
    }
    return aluno;
  }

  // Chave de comparação -> nome como está gravado.
  private async nomesDaTurma(turmaId: string): Promise<Map<string, string>> {
    const alunos = await this.banco.alunos.findMany({ where: { ClassID: turmaId }, select: { Nome: true } });
    return new Map(alunos.map((aluno) => [chaveDoNome(aluno.Nome), aluno.Nome]));
  }

  // Grava uma linha nova, com SenhaHash NULL (o primeiro login grava a
  // senha). Quem decide de verdade se o nome já existe é o UNIQUE
  // (ClassID, Nome) do banco: se a chave daqui e a collation discordarem
  // num caso raro, ou outra importação gravar o mesmo nome ao mesmo tempo,
  // o INSERT recusa (P2002) e o nome vai para jaEstavam, como deveria.
  private async adicionar(turmaId: string, nome: string, resultado: ResultadoImportacao): Promise<void> {
    try {
      const novo = await this.banco.alunos.create({
        data: { ID: randomUUID(), ClassID: turmaId, Nome: nome, SenhaHash: null },
      });
      resultado.adicionados.push(alunoNaForma(novo, SEM_SESSOES));
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) {
        throw erro;
      }
      const gravado = await this.banco.alunos.findFirst({ where: { ClassID: turmaId, Nome: nome } });
      resultado.jaEstavam.push(gravado?.Nome ?? nome);
    }
  }

  // Os agregados de todos os alunos da turma em duas consultas (e não duas
  // por aluno): uma conta todas as sessões e acha a última; a outra tira a
  // média só das concluídas — sessão em que o tempo estourou não entra na
  // média, como no mock.
  private async agregadosDaTurma(turmaId: string): Promise<Map<string, Agregados>> {
    const todas = await this.banco.sessionsprof.groupBy({
      by: ['AlunoID'],
      where: { ClassID: turmaId },
      _count: { _all: true },
      _max: { Data_Sessao: true },
    });
    const concluidas = await this.banco.sessionsprof.groupBy({
      by: ['AlunoID'],
      where: { ClassID: turmaId, Concluida: true },
      _avg: { WPM: true, Precisao: true },
    });
    const medias = new Map(concluidas.map((linha) => [linha.AlunoID, linha._avg]));

    const agregados = new Map<string, Agregados>();
    for (const linha of todas) {
      const media = medias.get(linha.AlunoID);
      agregados.set(linha.AlunoID, {
        totalSessoes: linha._count._all,
        wpmMedio: arredondarOuNull(media?.WPM),
        precisaoMedia: arredondarOuNull(media?.Precisao),
        ultimaAtividade: linha._max.Data_Sessao?.toISOString() ?? null,
      });
    }
    return agregados;
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

type LinhaDeAluno = { ID: string; Nome: string; SenhaHash: string | null; Data_Cadastro: Date | null };
type LinhaDeSessao = Prisma.sessionsprofGetPayload<object>;

function alunoNaForma(aluno: LinhaDeAluno, agregados: Agregados): Aluno {
  return {
    id: aluno.ID,
    nome: aluno.Nome,
    // Só a data ("2026-02-01"), como o contrato pede.
    entrouEm: aluno.Data_Cadastro ? aluno.Data_Cadastro.toISOString().slice(0, 10) : '',
    senhaDefinida: aluno.SenhaHash !== null,
    ...agregados,
  };
}

function sessaoNaForma(linha: LinhaDeSessao): Sessao {
  // WPM e Precisao são DECIMAL no banco (o Prisma devolve Decimal): Number
  // para a resposta sair como número no JSON, e não como texto.
  return {
    id: linha.ID,
    exerciseId: linha.ExerciseID,
    alunoId: linha.AlunoID,
    wpm: Number(linha.WPM ?? 0),
    precisao: Number(linha.Precisao ?? 0),
    tempoSegundos: linha.Tempo_Gasto_Segundos ?? 0,
    acertos: linha.Acertos ?? 0,
    erros: linha.Erros ?? 0,
    concluida: linha.Concluida,
    data: linha.Data_Sessao?.toISOString() ?? '',
  };
}

// Média inteira, ou null sem amostra.
function mediaInteira(numeros: number[]): number | null {
  if (numeros.length === 0) {
    return null;
  }
  const soma = numeros.reduce((total, numero) => total + numero, 0);
  return Math.round(soma / numeros.length);
}

// O _avg do Prisma: Decimal, ou null quando não há linha para a média.
function arredondarOuNull(valor: Prisma.Decimal | null | undefined): number | null {
  return valor === null || valor === undefined ? null : Math.round(Number(valor));
}

// Pontas aparadas e espaço repetido do meio reduzido a um: a forma em que
// o nome é gravado, e a que o login procura.
function normalizarNome(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

// Como o banco COMPARA o nome (collation utf8mb4_unicode_ci): sem
// diferença de maiúscula nem de acento. "ana pires" acha "Ána Pires" —
// a mesma regra do login. É a do mock (chaveDoNome em js/nucleo/mocks.ts).
function chaveDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function problemaNoNome(nome: string): string | null {
  if (nome.length === 0) {
    return 'Nome vazio.';
  }
  if (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {
    return `O nome precisa ter de ${NOME_MINIMO} a ${NOME_MAXIMO} caracteres.`;
  }
  return null;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
