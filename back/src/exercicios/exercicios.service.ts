// exercicios.service.ts
// A regra do grupo "Biblioteca de exercícios (professor)" do
// CONTRATO-API.md:
//   GET    /exercicios          a biblioteca do professor do token
//   GET    /exercicios/:id      o detalhe (professor; ou aluno, com ?turma=)
//   POST   /exercicios          cria
//   PATCH  /exercicios/:id      edita (o formulário inteiro)
//   DELETE /exercicios/:id      ARQUIVA (ver arquivar)
//
// O exercício pertence ao PROFESSOR, não a uma turma: existe uma vez só e
// vai para quantas turmas ele quiser (AtribuicoesProf).
//
// Exercício arquivado (ExerciciosProf.Ativo = false) é, para todas as
// rotas, um exercício que não existe: 404. A linha continua no banco só
// para as sessões antigas dos alunos continuarem apontando para ela.
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { professorDoToken, recusarProfessorIdNoCorpo } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export type Dificuldade = 'facil' | 'medio' | 'dificil';

// O corpo do POST e do PATCH (DadosExercicio no contrato) como chega.
// professorId só existe aqui para ser recusado.
export interface CorpoDoExercicio {
  titulo?: unknown;
  texto?: unknown;
  dificuldade?: unknown;
  tempoLimiteSegundos?: unknown;
  professorId?: unknown;
}

// O exercício na forma do tipo Exercicio do front (js/nucleo/tipos.ts).
export interface Exercicio {
  id: string;
  professorId: string;
  titulo: string;
  texto: string;
  dificuldade: Dificuldade;
  tempoLimiteSegundos: number;
  atribuidoA: number;
}

export interface Paginado<T> {
  total: number;
  pagina: number;
  itens: T[];
}

// O formulário já validado, com os nomes das colunas.
interface DadosValidados {
  Titulo: string;
  Texto: string;
  Dificuldade: Dificuldade;
  Tempo_Limite_Segundos: number;
}

// atribuidoA = em quantas turmas está: COUNT em AtribuicoesProf, feito
// pelo banco, nunca pela tela.
const COM_ATRIBUIDO_A = { _count: { select: { atribuicoesprof: true } } } satisfies Prisma.exerciciosprofInclude;

type ExercicioComContagem = Prisma.exerciciosprofGetPayload<{ include: typeof COM_ATRIBUIDO_A }>;

// Os limites do front (LIMITES em js/utils/validacao.ts), repetidos aqui
// porque o back não importa código do front; se um mudar, o outro muda
// junto. O back confere de novo porque um curl pula a tela.
const TITULO_MINIMO = 3;
const TITULO_MAXIMO = 100;
const TEXTO_MINIMO = 20;
const TEXTO_MAXIMO = 2000;
const TEMPO_MAXIMO = 3600;
const DIFICULDADES: Dificuldade[] = ['facil', 'medio', 'dificil'];

@Injectable()
export class ExerciciosService {
  constructor(private readonly banco: BancoService) {}

  // GET /exercicios. A biblioteca cresce sem teto, então o contrato a
  // embrulha no Paginado; por enquanto vem tudo numa página só (o contrato
  // não define tamanho de página). Busca e filtro são na tela.
  async listar(identidade: Identidade): Promise<Paginado<Exercicio>> {
    const professorId = professorDoToken(identidade);
    const linhas = await this.banco.exerciciosprof.findMany({
      where: { ProfessorID: professorId, Ativo: true },
      include: COM_ATRIBUIDO_A,
      orderBy: { Titulo: 'asc' },
    });
    return { total: linhas.length, pagina: 1, itens: linhas.map(exercicioNaForma) };
  }

  // GET /exercicios/:id?turma=:turmaId. A única rota destes grupos que
  // aceita token de aluno: é por ela que a tela de treino abre o texto.
  //   Conta: o exercício tem de ser dela; ?turma= é ignorado.
  //   Aluno: ?turma= tem de ser a turma DELE e o exercício tem de estar
  //   atribuído a ela — para ele descobrir na ABERTURA do treino, e não
  //   depois de digitar o texto inteiro.
  async obter(identidade: Identidade, id: string, turmaId: string | undefined): Promise<Exercicio> {
    if (identidade.tipo === 'aluno') {
      return exercicioNaForma(await this.exercicioDoAluno(identidade.id, id, turmaId));
    }
    return exercicioNaForma(await this.exercicioDaConta(identidade.id, id));
  }

  // POST /exercicios. O ProfessorID sai do token.
  async criar(identidade: Identidade, corpo: CorpoDoExercicio): Promise<Exercicio> {
    const professorId = professorDoToken(identidade);
    recusarProfessorIdNoCorpo(corpo);
    const dados = validarFormulario(corpo);

    const criado = await this.banco.exerciciosprof.create({
      data: { ExerciseID: randomUUID(), ProfessorID: professorId, ...dados },
      include: COM_ATRIBUIDO_A,
    });
    return exercicioNaForma(criado);
  }

  // PATCH /exercicios/:id. O contrato manda o formulário inteiro (o tipo
  // DadosExercicio tem os quatro campos obrigatórios), então os quatro são
  // validados e gravados, como no POST.
  async atualizar(identidade: Identidade, id: string, corpo: CorpoDoExercicio): Promise<Exercicio> {
    const professorId = professorDoToken(identidade);
    recusarProfessorIdNoCorpo(corpo);
    await this.exercicioDaConta(professorId, id);
    const dados = validarFormulario(corpo);

    const atualizado = await this.banco.exerciciosprof.update({
      where: { ExerciseID: id },
      data: dados,
      include: COM_ATRIBUIDO_A,
    });
    return exercicioNaForma(atualizado);
  }

  // DELETE /exercicios/:id. ARQUIVA, não apaga: um DELETE de verdade, pelo
  // ON DELETE CASCADE de SessionsProf, levaria as sessões dos alunos — que
  // são o trabalho DELES, não do professor.
  //
  // Arquivar = parou de ser usado, mas o que já foi feito fica:
  //   - some da biblioteca (Ativo = false);
  //   - sai de todas as turmas (as linhas de AtribuicoesProf dele são
  //     apagadas — essa tabela não guarda trabalho de aluno nenhum);
  //   - a linha de ExerciciosProf e as sessões já feitas continuam, então
  //     histórico e relatórios não mudam.
  // As duas gravações vão numa transação: ou as duas acontecem, ou nenhuma.
  async arquivar(identidade: Identidade, id: string): Promise<void> {
    const professorId = professorDoToken(identidade);
    await this.exercicioDaConta(professorId, id);
    await this.banco.$transaction([
      this.banco.atribuicoesprof.deleteMany({ where: { ExerciseID: id } }),
      this.banco.exerciciosprof.update({ where: { ExerciseID: id }, data: { Ativo: false } }),
    ]);
  }

  // O exercício, se for deste professor e não estiver arquivado. Se não
  // existe, é de outra conta ou foi arquivado: o mesmo 404.
  private async exercicioDaConta(professorId: string, id: string): Promise<ExercicioComContagem> {
    const exercicio = await this.banco.exerciciosprof.findFirst({
      where: { ExerciseID: id, ProfessorID: professorId, Ativo: true },
      include: COM_ATRIBUIDO_A,
    });
    if (!exercicio) {
      throw naoEncontrado();
    }
    return exercicio;
  }

  // O exercício visto pelo aluno: o aluno é da turma do ?turma= E o
  // exercício está atribuído a ela. Qualquer outra coisa é 404 — inclusive
  // sem ?turma=, porque a sessão nasceria fora de qualquer turma.
  private async exercicioDoAluno(
    alunoId: string,
    id: string,
    turmaId: string | undefined,
  ): Promise<ExercicioComContagem> {
    if (!turmaId) {
      throw naoEncontrado();
    }
    const aluno = await this.banco.alunos.findFirst({ where: { ID: alunoId, ClassID: turmaId } });
    const atribuicao = await this.banco.atribuicoesprof.findUnique({
      where: { ClassID_ExerciseID: { ClassID: turmaId, ExerciseID: id } },
      include: { exerciciosprof: { include: COM_ATRIBUIDO_A } },
    });
    // Ativo também, por segurança: arquivar já apaga as atribuições, então
    // um exercício arquivado nem chega a ter atribuicao aqui.
    if (!aluno || !atribuicao || !atribuicao.exerciciosprof.Ativo) {
      throw naoEncontrado();
    }
    return atribuicao.exerciciosprof;
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

function exercicioNaForma(linha: ExercicioComContagem): Exercicio {
  return {
    id: linha.ExerciseID,
    professorId: linha.ProfessorID,
    titulo: linha.Titulo,
    texto: linha.Texto,
    dificuldade: linha.Dificuldade,
    // A coluna aceita NULL; para o contrato, sem limite é 0.
    tempoLimiteSegundos: linha.Tempo_Limite_Segundos ?? 0,
    atribuidoA: linha._count.atribuicoesprof,
  };
}

// Valida os quatro campos e devolve já com os nomes das colunas. A primeira
// regra quebrada vira o 400, com a mesma mensagem que a tela mostra.
function validarFormulario(corpo: CorpoDoExercicio | undefined): DadosValidados {
  return {
    Titulo: tituloDoExercicio(corpo?.titulo),
    Texto: textoDoExercicio(corpo?.texto),
    Dificuldade: dificuldadeDoExercicio(corpo?.dificuldade),
    Tempo_Limite_Segundos: tempoDoExercicio(corpo?.tempoLimiteSegundos),
  };
}

function tituloDoExercicio(valor: unknown): string {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw dadosInvalidos('Dê um título ao exercício.');
  }
  const titulo = valor.trim();
  if (titulo.length < TITULO_MINIMO) {
    throw dadosInvalidos('O título precisa de pelo menos 3 caracteres.');
  }
  if (titulo.length > TITULO_MAXIMO) {
    throw dadosInvalidos('O título pode ter no máximo 100 caracteres.');
  }
  return titulo;
}

// Quebra de linha vira espaço, como a tela faz ao salvar
// (normalizarTextoExercicio): o motor de digitação trabalha com uma linha
// contínua. O tamanho é contado no texto já assim.
function textoDoExercicio(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw dadosInvalidos('Escreva o texto do exercício.');
  }
  const texto = valor.replace(/\r\n|\r|\n/g, ' ').trim();
  if (texto.length === 0) {
    throw dadosInvalidos('Escreva o texto do exercício.');
  }
  if (texto.length < TEXTO_MINIMO) {
    throw dadosInvalidos('O texto precisa de pelo menos 20 caracteres.');
  }
  if (texto.length > TEXTO_MAXIMO) {
    throw dadosInvalidos('O texto pode ter no máximo 2000 caracteres.');
  }
  return texto;
}

function dificuldadeDoExercicio(valor: unknown): Dificuldade {
  const dificuldade = DIFICULDADES.find((opcao) => opcao === valor);
  if (dificuldade === undefined) {
    throw dadosInvalidos('A dificuldade precisa ser facil, medio ou dificil.');
  }
  return dificuldade;
}

// Inteiro de 0 (sem limite) a 3600 segundos.
function tempoDoExercicio(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    throw dadosInvalidos('O tempo limite é um número inteiro de segundos.');
  }
  if (valor < 0 || valor > TEMPO_MAXIMO) {
    throw dadosInvalidos('O tempo limite vai de 0 a 3600 segundos.');
  }
  return valor;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}

function naoEncontrado(): NotFoundException {
  return new NotFoundException({ mensagem: 'Exercício não encontrado.', codigo: 'NAO_ENCONTRADO' });
}
