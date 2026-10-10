// atribuicoes.service.ts
// As três rotas de /turmas/:turmaId/atribuicoes (no CONTRATO-API.md, dentro
// do grupo "Turmas (professor)"): qual exercício da biblioteca do professor
// foi dado a qual turma dele.
//   GET    /turmas/:turmaId/atribuicoes                 visão do professor, com quem concluiu
//   POST   /turmas/:turmaId/atribuicoes                 atribui vários de uma vez
//   DELETE /turmas/:turmaId/atribuicoes/:exercicioId    tira um da turma
//
// A atribuição não tem id próprio: a chave de AtribuicoesProf é o PAR
// (ClassID, ExerciseID). Tirar um exercício da turma apaga só essa linha;
// as sessões que os alunos já fizeram nele continuam.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { professorDoToken, recusarProfessorIdNoCorpo } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { turmaDaConta } from '../turmas/turma-da-conta.js';

export interface CorpoDaAtribuicao {
  exercicioIds?: unknown;
  professorId?: unknown;
}

// Item do GET: a visão do PROFESSOR (AtribuicaoProfessor no front).
export interface AtribuicaoProfessor {
  exercicioId: string;
  titulo: string;
  dificuldade: 'facil' | 'medio' | 'dificil';
  atribuidoEm: string | null;
  concluidoPor: number;
  totalAlunos: number;
}

// Item da resposta do POST: a linha crua de AtribuicoesProf (Atribuicao no front).
export interface Atribuicao {
  exerciseId: string;
  atribuidoEm: string | null;
  prazo: string | null;
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
      include: { exerciciosprof: { select: { Titulo: true, Dificuldade: true } } },
      orderBy: { Data_Atribuicao: 'asc' },
    });
    const totalAlunos = await this.banco.alunos.count({ where: { ClassID: turmaId, Ativo: true } });
    const concluintes = await this.concluintesPorExercicio(turmaId);

    return atribuicoes.map((linha) => ({
      exercicioId: linha.ExerciseID,
      titulo: linha.exerciciosprof.Titulo,
      dificuldade: linha.exerciciosprof.Dificuldade,
      atribuidoEm: soData(linha.Data_Atribuicao),
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
    // chave primária é o par, e a data da primeira atribuição fica.
    await this.banco.atribuicoesprof.createMany({
      data: ids.map((exercicioId) => ({ ClassID: turmaId, ExerciseID: exercicioId })),
      skipDuplicates: true,
    });

    const lista = await this.banco.atribuicoesprof.findMany({
      where: { ClassID: turmaId },
      orderBy: { Data_Atribuicao: 'asc' },
    });
    return lista.map((linha) => ({
      exerciseId: linha.ExerciseID,
      atribuidoEm: soData(linha.Data_Atribuicao),
      prazo: linha.Prazo?.toISOString() ?? null,
    }));
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
      where: { ClassID: turmaId, Concluida: true, alunos: { Ativo: true } },
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

// Só a data ("2026-02-03"), como o contrato pede.
function soData(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
}
