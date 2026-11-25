// As três rotas de /turmas/:turmaId/atribuicoes (no CONTRATO-API.md, dentro
// do grupo "Turmas (professor)"): qual exercício da biblioteca do professor
// foi dado a qual turma dele.
//   GET    /turmas/:turmaId/atribuicoes                 visão do professor, com quem concluiu
//   POST   /turmas/:turmaId/atribuicoes                 atribui vários de uma vez
//   PATCH  /turmas/:turmaId/atribuicoes/:exercicioId    muda as repetições de uma
//   DELETE /turmas/:turmaId/atribuicoes/:exercicioId    tira um da turma
//
// A atribuição não tem id próprio: a chave de AtribuicoesProf é o PAR
// (ClassID, ExerciseID). Tirar um exercício da turma apaga só essa linha;
// as sessões que os alunos já fizeram nele continuam.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { dadosInvalidos } from '../dados-invalidos.js';
import { repeticoesValidas } from './repeticoes.js';
import { abertoEm } from './posts.js';
import { professorDoToken, recusarProfessorIdNoCorpo } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { diaDe } from '../sessoes/dias-seguidos.js';
import { turmaDaConta } from '../turmas/turma-da-conta.js';

export interface CorpoDaAtribuicao {
  exercicioIds?: unknown;
  // { [exercicioId]: 1 a 5 }; quem não está no mapa fica com 1.
  repeticoes?: unknown;
  professorId?: unknown;
}

// PATCH: o que muda numa atribuição que já existe.
export interface CorpoDaAlteracao {
  repeticoes?: unknown;
  professorId?: unknown;
}

// Item do GET: a visão do PROFESSOR (AtribuicaoProfessor no front).
export interface AtribuicaoProfessor {
  exercicioId: string;
  titulo: string;
  dificuldade: 'facil' | 'medio' | 'dificil';
  atribuidoEm: string | null;
  repeticoes: number;
  temPost: boolean;
  anexos: number;
  // ISO: quando abre para o aluno (no futuro = agendada).
  abertoEm: string | null;
  prazo: string | null;
  concluidoPor: number;
  totalAlunos: number;
}

// Item da resposta do POST: a linha crua de AtribuicoesProf (Atribuicao no front).
export interface Atribuicao {
  exerciseId: string;
  atribuidoEm: string | null;
  prazo: string | null;
  repeticoes: number;
}

@Injectable()
export class AtribuicoesService {
  constructor(private readonly banco: BancoService) {}

  // GET. concluidoPor e totalAlunos contados aqui: a tela não conta.
  async listar(identidade: Identidade, turmaId: string): Promise<AtribuicaoProfessor[]> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);

    const atribuicoes = await this.banco.atribuicoesprof.findMany({
      where: { ClassID: turmaId },
      include: {
        exerciciosprof: { select: { Titulo: true, Dificuldade: true } },
        atribuicoesposts: { select: { AbertoEm: true, _count: { select: { atribuicoesanexos: true } } } },
      },
      // Atribuir vários exercícios de uma vez grava todos no mesmo segundo
      // (Data_Atribuicao é DATETIME, sem milissegundo): no empate, o título
      // em ordem alfabética, e o id para dois títulos iguais.
      orderBy: [{ Data_Atribuicao: 'asc' }, { exerciciosprof: { Titulo: 'asc' } }, { ExerciseID: 'asc' }],
    });
    const totalAlunos = await this.banco.alunosturmas.count({ where: { ClassID: turmaId, Ativo: true } });
    const concluintes = await this.concluintesPorExercicio(turmaId);

    return atribuicoes.map((linha) => ({
      exercicioId: linha.ExerciseID,
      titulo: linha.exerciciosprof.Titulo,
      dificuldade: linha.exerciciosprof.Dificuldade,
      atribuidoEm: soData(linha.Data_Atribuicao),
      repeticoes: linha.Repeticoes,
      temPost: linha.atribuicoesposts !== null,
      anexos: linha.atribuicoesposts?._count.atribuicoesanexos ?? 0,
      abertoEm: abertoEm(linha)?.toISOString() ?? null,
      prazo: linha.Prazo?.toISOString() ?? null,
      concluidoPor: concluintes.get(linha.ExerciseID) ?? 0,
      totalAlunos,
    }));
  }

  // POST. Confere TODOS os ids antes de gravar qualquer um: metade
  // atribuída é pior do que nada atribuído, porque a tela mostraria erro e
  // o professor não saberia o que entrou.
  async atribuir(identidade: Identidade, turmaId: string, corpo: CorpoDaAtribuicao): Promise<Atribuicao[]> {
    const professorId = professorDoToken(identidade);
    recusarProfessorIdNoCorpo(corpo);
    const ids = idsDoCorpo(corpo?.exercicioIds);
    const repeticoes = repeticoesDoCorpo(corpo?.repeticoes, ids);
    await turmaDaConta(this.banco, professorId, turmaId);

    // Exercício arquivado conta como inexistente (404), como nas rotas de
    // /exercicios.
    const daConta = await this.banco.exerciciosprof.count({
      where: { ExerciseID: { in: ids }, ProfessorID: professorId, Ativo: true },
    });
    if (daConta !== ids.length) {
      throw new NotFoundException({ mensagem: 'Exercício não encontrado.', codigo: 'NAO_ENCONTRADO' });
    }

    // skipDuplicates: repetir um já atribuído não é erro nem duplica — a
    // chave primária é o par, e a data (e as repetições) da primeira
    // atribuição ficam: para mudar as repetições, o PATCH.
    await this.banco.atribuicoesprof.createMany({
      data: ids.map((exercicioId) => ({ ClassID: turmaId, ExerciseID: exercicioId, Repeticoes: repeticoes.get(exercicioId) ?? 1 })),
      skipDuplicates: true,
    });

    const lista = await this.banco.atribuicoesprof.findMany({
      where: { ClassID: turmaId },
      // Atribuir vários exercícios de uma vez grava todos no mesmo segundo
      // (Data_Atribuicao é DATETIME, sem milissegundo): no empate, o título
      // em ordem alfabética, e o id para dois títulos iguais.
      orderBy: [{ Data_Atribuicao: 'asc' }, { exerciciosprof: { Titulo: 'asc' } }, { ExerciseID: 'asc' }],
    });
    return lista.map(atribuicaoNaForma);
  }

  // PATCH. Vale para as próximas tentativas: as sessões já feitas ficam
  // como foram. Turma de outra conta ou exercício não atribuído: 404.
  async alterar(identidade: Identidade, turmaId: string, exercicioId: string, corpo: CorpoDaAlteracao): Promise<Atribuicao> {
    const professorId = professorDoToken(identidade);
    recusarProfessorIdNoCorpo(corpo);
    if (corpo?.repeticoes === undefined) {
      throw dadosInvalidos('Mande repeticoes.');
    }
    const repeticoes = repeticoesValidas(corpo.repeticoes);
    await turmaDaConta(this.banco, professorId, turmaId);
    const alterou = await this.banco.atribuicoesprof.updateMany({
      where: { ClassID: turmaId, ExerciseID: exercicioId },
      data: { Repeticoes: repeticoes },
    });
    if (alterou.count === 0) {
      throw new NotFoundException({ mensagem: 'Atribuição não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    const linha = await this.banco.atribuicoesprof.findUniqueOrThrow({
      where: { ClassID_ExerciseID: { ClassID: turmaId, ExerciseID: exercicioId } },
    });
    return atribuicaoNaForma(linha);
  }

  // DELETE. Turma de outra conta, ou exercício que não está atribuído a
  // ela: o mesmo 404.
  async remover(identidade: Identidade, turmaId: string, exercicioId: string): Promise<void> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    const apagou = await this.banco.atribuicoesprof.deleteMany({
      where: { ClassID: turmaId, ExerciseID: exercicioId },
    });
    if (apagou.count === 0) {
      throw new NotFoundException({ mensagem: 'Atribuição não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
  }

  // Quantos alunos ATIVOS da turma concluíram cada exercício: pares
  // (aluno, exercício) distintos de sessões concluídas, contados por
  // exercício. Aluno que concluiu duas vezes conta uma.
  private async concluintesPorExercicio(turmaId: string): Promise<Map<string, number>> {
    const pares = await this.banco.sessionsprof.findMany({
      where: { ClassID: turmaId, Concluida: true, alunosturmas: { Ativo: true } },
      select: { ExerciseID: true, AlunoID: true },
      distinct: ['ExerciseID', 'AlunoID'],
    });
    const contagem = new Map<string, number>();
    for (const par of pares) {
      contagem.set(par.ExerciseID, (contagem.get(par.ExerciseID) ?? 0) + 1);
    }
    return contagem;
  }
}

// A lista de ids, sem repetição. Vazia ou que não é lista de textos: 400.
function idsDoCorpo(valor: unknown): string[] {
  if (!Array.isArray(valor) || valor.length === 0 || !valor.every((id) => typeof id === 'string')) {
    throw new BadRequestException({
      mensagem: 'Mande exercicioIds: uma lista com pelo menos um id.',
      codigo: 'DADOS_INVALIDOS',
    });
  }
  return [...new Set(valor as string[])];
}

// O mapa { [exercicioId]: repetições } do POST. Ausente: todos com 1. Id
// que não está em exercicioIds é 400: a tela mandou repetição de um
// exercício que não ia atribuir.
function repeticoesDoCorpo(valor: unknown, ids: string[]): Map<string, number> {
  if (valor === undefined) {
    return new Map();
  }
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw dadosInvalidos('repeticoes precisa ser um objeto { exercicioId: 1 a 5 }.');
  }
  const mapa = new Map<string, number>();
  for (const [id, n] of Object.entries(valor)) {
    if (!ids.includes(id)) {
      throw dadosInvalidos('repeticoes tem um exercício que não está em exercicioIds.');
    }
    mapa.set(id, repeticoesValidas(n));
  }
  return mapa;
}

function atribuicaoNaForma(linha: { ExerciseID: string; Data_Atribuicao: Date | null; Prazo: Date | null; Repeticoes: number }): Atribuicao {
  return {
    exerciseId: linha.ExerciseID,
    atribuidoEm: soData(linha.Data_Atribuicao),
    prazo: linha.Prazo?.toISOString() ?? null,
    repeticoes: linha.Repeticoes,
  };
}

// Só a data ("2026-02-03"), como o contrato pede.
function soData(data: Date | null): string | null {
  return data ? diaDe(data) : null;
}
