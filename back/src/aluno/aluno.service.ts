// aluno.service.ts
// A regra do grupo "Aluno" do CONTRATO-API.md: o PRÓPRIO aluno logado, nas
// telas de pages/aluno/. (Não confundir com o grupo "Alunos", em
// src/alunos/, que é o professor administrando a turma.)
//   GET /aluno/historico                    todas as sessões dele
//   GET /aluno/resumo                       os números do topo do histórico
//   GET /aluno/salas                        a turma dele, com o progresso dele
//   GET /aluno/salas/:turmaId               a sala e o estado de cada exercício
//   GET /turmas/:turmaId/meu-desempenho     o relatório individual dele na sala
//
// Vale para todas:
//   - O aluno sai do TOKEN (Alunos.ID). Nenhuma rota recebe id de aluno:
//     não existe caminho, nem por URL editada à mão, para pedir os números
//     de outro aluno.
//   - Token de conta é 403 TIPO_INVALIDO.
//   - Na v8 o aluno está numa turma só (Alunos.ClassID). :turmaId que não é
//     a dele, ou que está arquivada, é 404 — e não 403, que diria "essa
//     turma existe, só não é sua".
//   - Nenhum número de colega sai daqui, só a média da sala inteira.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Paginado } from '../relatorios/relatorios.service.js';
import { contarDiasSeguidos, diaDe } from '../sessoes/dias-seguidos.js';
import { arredondarOuNull, mediaInteira, sessaoNaForma } from '../sessoes/sessao-escola.js';
import type { Sessao } from '../sessoes/sessao-escola.js';

// Uma linha do histórico (SessaoDoHistorico no front): a sessão, a turma,
// e os dois JOINs — título do exercício e nome da turma.
export interface SessaoDoHistorico extends Sessao {
  turmaId: string;
  tituloExercicio: string | null;
  nomeTurma: string | null;
}

export interface ResumoDoAluno {
  sessoesTotais: number;
  sessoesConcluidas: number;
  wpmMedio: number | null;
  precisaoMedia: number | null;
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  diasSeguidos: number;
}

export interface SalaDoAluno {
  id: string;
  nome: string;
  professor: string | null;
  capaSemente?: number;
  totalAlunos: number;
  exerciciosFeitos: number;
  exerciciosTotal: number;
}

export type EstadoDoExercicio = 'nao_feito' | 'feito' | 'tempo_esgotado';

// Um exercício da sala, com o estado PARA ESTE aluno (ExercicioDaSala).
export interface ExercicioDaSala {
  id: string;
  titulo: string;
  dificuldade: string;
  caracteres: number;
  tempoLimiteSegundos: number;
  atribuidoEm: string | null;
  prazo: string | null;
  estado: EstadoDoExercicio;
  melhorWpm: number | null;
  melhorPrecisao: number | null;
  ultimaSessao: string | null;
}

export interface SalaDetalhe extends SalaDoAluno {
  lista: ExercicioDaSala[];
}

// Ritmo (PPM) e precisão (%), inteiros.
export interface MediaDaSala {
  velocidade: number | null;
  precisao: number | null;
}

export interface DesempenhoNaTurma {
  sessoesConcluidas: number;
  licoes: number;
  diasSeguidos: number;
  minhaMedia: MediaDaSala | null;
  mediaSala: MediaDaSala | null;
}

// Abaixo disto, a média de uma pessoa não diz nada: uma sessão ruim (ou
// boa) decide tudo. As duas médias vêm null, e a tela mostra quanto falta.
// O número é o do contrato (e o MINIMO_DE_SESSOES do mock).
const MINIMO_DE_SESSOES_PARA_MEDIA = 3;

// A turma do aluno, com o nome do professor dono dela.
const TURMA_COM_PROFESSOR = {
  classesprof: { include: { users: { select: { Nome: true } } } },
} satisfies Prisma.alunosInclude;

type TurmaDoAluno = Prisma.classesprofGetPayload<{ include: { users: { select: { Nome: true } } } }>;

@Injectable()
export class AlunoService {
  constructor(private readonly banco: BancoService) {}

  // GET /aluno/historico. Da mais recente para a mais antiga: a ordem é
  // parte do contrato, e a tela não reordena. Sem tamanho de página
  // definido: vem tudo, com pagina = 1.
  async historico(identidade: Identidade): Promise<Paginado<SessaoDoHistorico>> {
    const alunoId = alunoDoToken(identidade);
    const linhas = await this.banco.sessionsprof.findMany({
      where: { AlunoID: alunoId },
      include: {
        exerciciosprof: { select: { Titulo: true } },
        classesprof: { select: { NomeTurma: true } },
      },
      orderBy: { Data_Sessao: 'desc' },
    });
    const itens = linhas.map((linha) => ({
      ...sessaoNaForma(linha),
      turmaId: linha.ClassID,
      // Exercício arquivado mantém o título: a linha dele fica no banco.
      tituloExercicio: linha.exerciciosprof.Titulo,
      nomeTurma: linha.classesprof.NomeTurma,
    }));
    return { total: itens.length, pagina: 1, itens };
  }

  // GET /aluno/resumo. Médias só das concluídas (null sem nenhuma), melhores
  // marcas de TODAS (o PPM da sessão em que o tempo acabou também foi dele)
  // e os dias seguidos. Só os números dele: não há média de turma aqui.
  async resumo(identidade: Identidade): Promise<ResumoDoAluno> {
    const alunoId = alunoDoToken(identidade);
    const linhas = await this.banco.sessionsprof.findMany({ where: { AlunoID: alunoId } });
    const sessoes = linhas.map(sessaoNaForma);
    const concluidas = sessoes.filter((sessao) => sessao.concluida);
    return {
      sessoesTotais: sessoes.length,
      // COUNT, não média: zero aqui é zero mesmo.
      sessoesConcluidas: concluidas.length,
      wpmMedio: mediaInteira(concluidas.map((sessao) => sessao.wpm)),
      precisaoMedia: mediaInteira(concluidas.map((sessao) => sessao.precisao)),
      melhorWpm: maiorOuNull(sessoes.map((sessao) => sessao.wpm)),
      melhorPrecisao: maiorOuNull(sessoes.map((sessao) => sessao.precisao)),
      diasSeguidos: contarDiasSeguidos(linhas),
    };
  }

  // GET /aluno/salas. Uma lista com no máximo um item: a turma dele, se
  // estiver ativa. Turma arquivada não aparece (não há mais o que fazer
  // nela); o histórico continua mostrando as sessões.
  async salas(identidade: Identidade): Promise<SalaDoAluno[]> {
    const alunoId = alunoDoToken(identidade);
    const aluno = await this.banco.alunos.findUnique({ where: { ID: alunoId }, include: TURMA_COM_PROFESSOR });
    if (!aluno || !aluno.classesprof.Ativa) {
      return [];
    }
    const lista = await this.exerciciosDaSala(aluno.ClassID, alunoId);
    return [await this.resumoDaSala(aluno.classesprof, lista)];
  }

  // GET /aluno/salas/:turmaId. O :turmaId é da SALA, nunca de aluno.
  async sala(identidade: Identidade, turmaId: string): Promise<SalaDetalhe> {
    const alunoId = alunoDoToken(identidade);
    const turma = await this.salaDoAluno(alunoId, turmaId);
    const lista = await this.exerciciosDaSala(turmaId, alunoId);
    return { ...(await this.resumoDaSala(turma, lista)), lista };
  }

  // GET /turmas/:turmaId/meu-desempenho. Só sessões desta turma. Com menos
  // de 3 concluídas, as duas médias vêm null.
  async meuDesempenho(identidade: Identidade, turmaId: string): Promise<DesempenhoNaTurma> {
    const alunoId = alunoDoToken(identidade);
    await this.salaDoAluno(alunoId, turmaId);

    const linhas = await this.banco.sessionsprof.findMany({ where: { AlunoID: alunoId, ClassID: turmaId } });
    const concluidas = linhas.map(sessaoNaForma).filter((sessao) => sessao.concluida);
    const resposta: DesempenhoNaTurma = {
      sessoesConcluidas: concluidas.length,
      // Exercícios DIFERENTES concluídos.
      licoes: new Set(concluidas.map((sessao) => sessao.exerciseId)).size,
      diasSeguidos: contarDiasSeguidos(linhas),
      minhaMedia: null,
      mediaSala: null,
    };
    if (concluidas.length < MINIMO_DE_SESSOES_PARA_MEDIA) {
      return resposta;
    }

    resposta.minhaMedia = {
      velocidade: mediaInteira(concluidas.map((sessao) => sessao.wpm)),
      precisao: mediaInteira(concluidas.map((sessao) => sessao.precisao)),
    };
    // A média da sala é sobre as sessões concluídas de TODOS os alunos
    // ativos dela, ele incluído. Sai só a média: nenhum número de colega.
    const daSala = await this.banco.sessionsprof.aggregate({
      where: { ClassID: turmaId, Concluida: true, alunos: { Ativo: true } },
      _avg: { WPM: true, Precisao: true },
    });
    resposta.mediaSala = {
      velocidade: arredondarOuNull(daSala._avg.WPM),
      precisao: arredondarOuNull(daSala._avg.Precisao),
    };
    return resposta;
  }

  // A turma, se for a do aluno e estiver ativa; senão 404. "Não é sua" e
  // "não existe" dão a mesma resposta.
  private async salaDoAluno(alunoId: string, turmaId: string): Promise<TurmaDoAluno> {
    const aluno = await this.banco.alunos.findUnique({ where: { ID: alunoId }, include: TURMA_COM_PROFESSOR });
    if (!aluno || aluno.ClassID !== turmaId || !aluno.classesprof.Ativa) {
      throw new NotFoundException({ mensagem: 'Sala não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    return aluno.classesprof;
  }

  // O cabeçalho da sala. exerciciosFeitos = atribuídos em que ele tem
  // sessão (concluída OU com o tempo esgotado: os dois são "já fiz").
  private async resumoDaSala(turma: TurmaDoAluno, lista: ExercicioDaSala[]): Promise<SalaDoAluno> {
    const totalAlunos = await this.banco.alunos.count({ where: { ClassID: turma.ClassID, Ativo: true } });
    const sala: SalaDoAluno = {
      id: turma.ClassID,
      nome: turma.NomeTurma ?? '',
      professor: turma.users.Nome,
      totalAlunos,
      exerciciosFeitos: lista.filter((exercicio) => exercicio.estado !== 'nao_feito').length,
      exerciciosTotal: lista.length,
    };
    // capaSemente é opcional no tipo, como em GET /turmas: sem valor, nem
    // aparece (a tela deriva uma do id).
    if (turma.CapaSemente !== null) {
      sala.capaSemente = turma.CapaSemente;
    }
    return sala;
  }

  // Os exercícios atribuídos à turma, na ordem da atribuição, cada um com o
  // estado e a melhor marca DESTE aluno. O texto não vai: só a contagem de
  // caracteres, feita aqui porque é o back que tem o texto.
  private async exerciciosDaSala(turmaId: string, alunoId: string): Promise<ExercicioDaSala[]> {
    const atribuicoes = await this.banco.atribuicoesprof.findMany({
      where: { ClassID: turmaId, exerciciosprof: { Ativo: true } },
      include: { exerciciosprof: true },
      orderBy: { Data_Atribuicao: 'asc' },
    });
    const linhas = await this.banco.sessionsprof.findMany({ where: { AlunoID: alunoId, ClassID: turmaId } });
    const sessoes = linhas.map(sessaoNaForma);

    return atribuicoes.map((atribuicao) => {
      const exercicio = atribuicao.exerciciosprof;
      const doExercicio = sessoes.filter((sessao) => sessao.exerciseId === exercicio.ExerciseID);
      // A marca que aparece é a melhor das concluídas; sem nenhuma
      // concluída, a melhor das vezes em que o tempo acabou.
      const concluidas = doExercicio.filter((sessao) => sessao.concluida);
      const contam = concluidas.length > 0 ? concluidas : doExercicio;
      return {
        id: exercicio.ExerciseID,
        titulo: exercicio.Titulo,
        dificuldade: exercicio.Dificuldade,
        caracteres: exercicio.Texto.length,
        tempoLimiteSegundos: exercicio.Tempo_Limite_Segundos ?? 0,
        atribuidoEm: soData(atribuicao.Data_Atribuicao),
        prazo: atribuicao.Prazo?.toISOString() ?? null,
        estado: estadoDoExercicio(doExercicio),
        melhorWpm: maiorOuNull(contam.map((sessao) => sessao.wpm)),
        melhorPrecisao: maiorOuNull(contam.map((sessao) => sessao.precisao)),
        ultimaSessao: ultimaData(doExercicio),
      };
    });
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

// O id do aluno do token, ou 403 TIPO_INVALIDO se o token é de conta.
function alunoDoToken(identidade: Identidade): string {
  if (identidade.tipo !== 'aluno') {
    throw new ForbiddenException({ mensagem: 'Rota só para alunos.', codigo: 'TIPO_INVALIDO' });
  }
  return identidade.id;
}

// Sem sessão: não fez. Com alguma concluída: feito (uma vez feito, uma
// tentativa pior depois não desfaz). Só com o tempo esgotado: tempo_esgotado.
function estadoDoExercicio(sessoes: Sessao[]): EstadoDoExercicio {
  if (sessoes.length === 0) {
    return 'nao_feito';
  }
  return sessoes.some((sessao) => sessao.concluida) ? 'feito' : 'tempo_esgotado';
}

// O maior número, ou null sem nenhum (nunca 0: zero seria uma marca).
function maiorOuNull(numeros: number[]): number | null {
  return numeros.length === 0 ? null : Math.max(...numeros);
}

// A data ISO mais recente, ou null sem sessão. ISO ordena como texto.
function ultimaData(sessoes: Sessao[]): string | null {
  const datas = sessoes.map((sessao) => sessao.data).sort();
  return datas.length === 0 ? null : datas[datas.length - 1];
}

// Só a data ("2026-02-03"), como GET /turmas/:id/atribuicoes devolve.
function soData(data: Date | null): string | null {
  return data ? diaDe(data) : null;
}
