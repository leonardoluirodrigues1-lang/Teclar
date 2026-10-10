// relatorios.service.ts
// A regra do grupo "Relatórios (professor)" do CONTRATO-API.md:
//   GET /turmas/:turmaId/relatorio                      as quatro métricas do topo
//   GET /turmas/:turmaId/relatorio/alunos               uma linha por aluno
//   GET /turmas/:turmaId/relatorio/exercicios           uma linha por exercício atribuído
//   GET /turmas/:turmaId/alunos/:alunoId/sessoes        o histórico de um aluno
//
// Tudo chega PRONTO: nenhuma média é calculada na tela, e média sem
// amostra vem null (a tela mostra "—"), nunca 0.
//
// Quais sessões contam: TODAS as da turma (SessionsProf.ClassID), dos
// alunos ativos dela. Inclusive as de exercício arquivado ou que o
// professor tirou da turma — o que o aluno já fez não some do relatório
// por uma ação do professor (decisão do projeto, anotada no contrato).
import { Injectable, NotFoundException } from '@nestjs/common';
import { AlunosService } from '../alunos/alunos.service.js';
import type { Aluno } from '../alunos/alunos.service.js';
import { AtribuicoesService } from '../atribuicoes/atribuicoes.service.js';
import type { AtribuicaoProfessor } from '../atribuicoes/atribuicoes.service.js';
import { professorDoToken } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { arredondarOuNull, sessaoNaForma } from '../sessoes/sessao-escola.js';
import type { Sessao } from '../sessoes/sessao-escola.js';
import { turmaDaConta } from '../turmas/turma-da-conta.js';

export interface RelatorioTurma {
  turmaId: string;
  totalAlunos: number;
  alunosComSessao: number;
  alunosAtivos: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  exerciciosConcluidos: number;
}

// A linha de GET /turmas/:id/alunos mais as duas contagens de exercício.
export interface RelatorioAluno extends Aluno {
  exerciciosConcluidos: number;
  exerciciosAtribuidos: number;
}

// A linha de GET /turmas/:id/atribuicoes mais as médias e os estouros.
export interface RelatorioExercicio extends AtribuicaoProfessor {
  wpmMedio: number | null;
  precisaoMedia: number | null;
  estouraramTempo: number;
}

export interface SessaoDoAluno extends Sessao {
  tituloExercicio: string | null;
}

export interface Paginado<T> {
  total: number;
  pagina: number;
  itens: T[];
}

// "Aluno ativo" = treinou nos últimos 7 dias. A janela é decisão do back:
// a tela recebe o número já contado e não sabe que são 7 dias.
const DIAS_DE_ATIVIDADE = 7;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class RelatoriosService {
  constructor(
    private readonly banco: BancoService,
    private readonly alunos: AlunosService,
    private readonly atribuicoes: AtribuicoesService,
  ) {}

  // GET /turmas/:turmaId/relatorio.
  async daTurma(identidade: Identidade, turmaId: string): Promise<RelatorioTurma> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    const daTurma = sessoesDaTurma(turmaId);

    const totalAlunos = await this.banco.alunos.count({ where: { ClassID: turmaId, Ativo: true } });
    const comSessao = await this.banco.sessionsprof.findMany({
      where: daTurma,
      select: { AlunoID: true },
      distinct: ['AlunoID'],
    });
    const desde = new Date(Date.now() - DIAS_DE_ATIVIDADE * MILISSEGUNDOS_POR_DIA);
    const ativos = await this.banco.sessionsprof.findMany({
      where: { ...daTurma, Data_Sessao: { gte: desde } },
      select: { AlunoID: true },
      distinct: ['AlunoID'],
    });
    // Médias sobre as SESSÕES concluídas da turma (não média das médias de
    // cada aluno): é o que o contrato diz. Sessão em que o tempo estourou
    // não entra.
    const medias = await this.banco.sessionsprof.aggregate({
      where: { ...daTurma, Concluida: true },
      _avg: { WPM: true, Precisao: true },
    });
    // Pares (aluno, exercício) concluídos: o mesmo aluno concluindo o mesmo
    // exercício duas vezes conta uma. É COUNT: zero aqui é zero mesmo.
    const paresConcluidos = await this.banco.sessionsprof.findMany({
      where: { ...daTurma, Concluida: true },
      select: { AlunoID: true, ExerciseID: true },
      distinct: ['AlunoID', 'ExerciseID'],
    });

    return {
      turmaId,
      totalAlunos,
      alunosComSessao: comSessao.length,
      alunosAtivos: ativos.length,
      wpmMedio: arredondarOuNull(medias._avg.WPM),
      precisaoMedia: arredondarOuNull(medias._avg.Precisao),
      exerciciosConcluidos: paresConcluidos.length,
    };
  }

  // GET /turmas/:turmaId/relatorio/alunos. A linha de GET /turmas/:id/alunos
  // (o AlunosService já confere o token e a turma, e faz os agregados) mais
  // quantos exercícios DISTINTOS cada um concluiu e quantos a turma tem.
  async porAluno(identidade: Identidade, turmaId: string): Promise<RelatorioAluno[]> {
    const linhas = await this.alunos.listar(identidade, turmaId);
    const exerciciosAtribuidos = await this.banco.atribuicoesprof.count({ where: { ClassID: turmaId } });
    const paresConcluidos = await this.banco.sessionsprof.findMany({
      where: { ...sessoesDaTurma(turmaId), Concluida: true },
      select: { AlunoID: true, ExerciseID: true },
      distinct: ['AlunoID', 'ExerciseID'],
    });

    return linhas.map((linha) => ({
      ...linha,
      exerciciosConcluidos: paresConcluidos.filter((par) => par.AlunoID === linha.id).length,
      exerciciosAtribuidos,
    }));
  }

  // GET /turmas/:turmaId/relatorio/exercicios. Uma linha por exercício
  // ATRIBUÍDO (a linha de GET /turmas/:id/atribuicoes, que já confere o
  // token e a turma e conta concluidoPor), mais as médias da turma nele e
  // quantas sessões estouraram o tempo.
  async porExercicio(identidade: Identidade, turmaId: string): Promise<RelatorioExercicio[]> {
    const linhas = await this.atribuicoes.listar(identidade, turmaId);
    const daTurma = sessoesDaTurma(turmaId);

    const mediasPorExercicio = await this.banco.sessionsprof.groupBy({
      by: ['ExerciseID'],
      where: { ...daTurma, Concluida: true },
      _avg: { WPM: true, Precisao: true },
    });
    const naoConcluidasPorExercicio = await this.banco.sessionsprof.groupBy({
      by: ['ExerciseID'],
      where: { ...daTurma, Concluida: false },
      _count: { _all: true },
    });
    const temposLimite = await this.banco.exerciciosprof.findMany({
      where: { ExerciseID: { in: linhas.map((linha) => linha.exercicioId) } },
      select: { ExerciseID: true, Tempo_Limite_Segundos: true },
    });

    return linhas.map((linha) => {
      const medias = mediasPorExercicio.find((m) => m.ExerciseID === linha.exercicioId)?._avg;
      const naoConcluidas = naoConcluidasPorExercicio.find((n) => n.ExerciseID === linha.exercicioId);
      const tempoLimite = temposLimite.find((t) => t.ExerciseID === linha.exercicioId)?.Tempo_Limite_Segundos ?? 0;
      return {
        ...linha,
        wpmMedio: arredondarOuNull(medias?.WPM),
        precisaoMedia: arredondarOuNull(medias?.Precisao),
        // Sem tempo limite não há tempo para estourar: 0, sempre. Uma sessão
        // não concluída num exercício sem limite é outra coisa (o aluno
        // desistiu), e não pode ser contada como estouro.
        estouraramTempo: tempoLimite > 0 ? (naoConcluidas?._count._all ?? 0) : 0,
      };
    });
  }

  // GET /turmas/:turmaId/alunos/:alunoId/sessoes. O :alunoId é o aluno-ALVO,
  // e só vale dentro da turma: de outra turma é 404, e não lista vazia
  // (lista vazia diria "está na turma e nunca treinou", que é outra coisa).
  async sessoesDoAluno(identidade: Identidade, turmaId: string, alunoId: string): Promise<Paginado<SessaoDoAluno>> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    const aluno = await this.banco.alunos.findFirst({ where: { ID: alunoId, ClassID: turmaId } });
    if (!aluno) {
      throw new NotFoundException({ mensagem: 'Aluno não encontrado nesta turma.', codigo: 'NAO_ENCONTRADO' });
    }

    // A ordem (mais recente primeiro) é parte do contrato: a tela não
    // reordena. O título vem do JOIN com ExerciciosProf — exercício
    // arquivado continua com título, porque a linha dele fica no banco.
    const linhas = await this.banco.sessionsprof.findMany({
      where: { AlunoID: alunoId, ClassID: turmaId },
      include: { exerciciosprof: { select: { Titulo: true } } },
      orderBy: { Data_Sessao: 'desc' },
    });
    const itens = linhas.map((linha) => ({
      ...sessaoNaForma(linha),
      tituloExercicio: linha.exerciciosprof?.Titulo ?? null,
    }));
    // O contrato não define tamanho de página: vem tudo, com pagina = 1,
    // como no GET /exercicios.
    return { total: itens.length, pagina: 1, itens };
  }
}

// As sessões que os relatórios contam: as da turma, dos alunos ativos dela.
function sessoesDaTurma(turmaId: string) {
  return { ClassID: turmaId, alunos: { Ativo: true } };
}
