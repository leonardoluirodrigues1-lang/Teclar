// sessoes.service.ts
// A regra do grupo "Sessões" do CONTRATO-API.md:
//   POST /sessoes      o aluno grava o treino que acabou de fazer
//   GET  /sessoes/:id  o dono relê uma sessão (o F5 da tela de resultado)
//
// O aluno sai SEMPRE do token. A sessão só nasce se o exercício estiver
// atribuído à turma do aluno: sem essa regra, um aluno gravaria sessão num
// exercício que o professor nunca deu, e ela apareceria nos relatórios.
import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { sessaoNaForma } from './sessao-escola.js';
import type { LinhaDeSessao, Sessao } from './sessao-escola.js';

// O corpo do POST como chega (DadosSessaoTreino no contrato), em
// snake_case como o motor da tela manda. Os três ids de pessoa só existem
// aqui para serem RECUSADOS.
export interface CorpoDaSessao {
  exercicio_id?: unknown;
  turma_id?: unknown;
  wpm?: unknown;
  precisao?: unknown;
  acertos?: unknown;
  erros?: unknown;
  tempo_gasto_segundos?: unknown;
  concluida?: unknown;
  usuario_id?: unknown;
  alunoId?: unknown;
  professorId?: unknown;
}

// A sessão Escola com a turma, como POST e GET devolvem.
export interface SessaoEscola extends Sessao {
  turmaId: string;
}

export interface RespostaSessaoEscola extends SessaoEscola {
  recordePessoal: boolean;
}

// A sessão do Solo (tabela SessionsSolo), como GET /sessoes/:id devolve
// para token de conta.
export interface SessaoSolo {
  id: string;
  exerciseId: string;
  wpm: number;
  precisao: number;
  tempoSegundos: number;
  acertos: number;
  erros: number;
  concluida: boolean;
  xpGanho: number;
  data: string;
}

// O pacote do motor já validado, com os nomes das colunas.
interface MedidasValidadas {
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

@Injectable()
export class SessoesService {
  constructor(private readonly banco: BancoService) {}

  // POST /sessoes. A ordem das conferências é de propósito: primeiro quem
  // pede (403, 400 de identidade, 401), depois o corpo (400), e só então a
  // turma e o exercício (404) — assim um 404 nunca sai para um corpo que
  // nem seria aceito.
  async registrar(identidade: Identidade, corpo: CorpoDaSessao): Promise<RespostaSessaoEscola> {
    if (identidade.tipo !== 'aluno') {
      throw new ForbiddenException({
        mensagem: 'Só aluno grava sessão aqui: a do Solo é POST /solo/sessoes.',
        codigo: 'TIPO_INVALIDO',
      });
    }
    recusarIdDePessoaNoCorpo(corpo);
    const aluno = await this.alunoComSessaoValida(identidade.id);
    const exercicioId = idDoCorpo(corpo?.exercicio_id, 'exercicio_id');
    const turmaId = idDoCorpo(corpo?.turma_id, 'turma_id');
    const medidas = validarMedidas(corpo);

    // turma_id tem de ser a turma DELE (Alunos.ClassID): na v8 o aluno está
    // numa turma só. Turma de outro é 404, não 403.
    if (turmaId !== aluno.ClassID) {
      throw naoEncontrado('Exercício não encontrado nesta turma.');
    }
    await this.exigirAtribuido(turmaId, exercicioId);

    const melhorAntes = await this.melhorPpmAnterior(aluno.ID, exercicioId);
    const gravada = await this.banco.sessionsprof.create({
      data: { ID: randomUUID(), AlunoID: aluno.ID, ExerciseID: exercicioId, ClassID: turmaId, ...medidas },
    });
    const sessao = sessaoEscolaNaForma(gravada);
    // Recorde = PPM maior que o melhor anterior dele NESTE exercício. Na
    // primeira vez o "melhor anterior" é 0, como no mock: a primeira sessão
    // com PPM acima de zero já é recorde.
    return { ...sessao, recordePessoal: sessao.wpm > melhorAntes };
  }

  // GET /sessoes/:id. Só o DONO lê, e a tabela depende de quem pede:
  //   aluno -> SessionsProf, só as dele (AlunoID);
  //   conta -> SessionsSolo, só as da campanha dele (CampanhaID do jogador).
  // Sessão de outra pessoa é o mesmo 404 da que não existe: é a rota do F5
  // da tela de resultado, e trocar o ?sessao= da URL não pode mostrar o
  // treino de outra pessoa nem confirmar que ele existe.
  async obter(identidade: Identidade, id: string): Promise<SessaoEscola | SessaoSolo> {
    if (identidade.tipo === 'aluno') {
      const daEscola = await this.banco.sessionsprof.findFirst({ where: { ID: id, AlunoID: identidade.id } });
      if (daEscola) {
        return sessaoEscolaNaForma(daEscola);
      }
    } else {
      const doSolo = await this.banco.sessionssolo.findFirst({
        where: { ID: id, campanhassolo: { JogadorID: identidade.id } },
      });
      if (doSolo) {
        return sessaoSoloNaForma(doSolo);
      }
    }
    throw naoEncontrado('Sessão não encontrada.');
  }

  // O aluno do token, se ainda pode treinar. Aluno removido ou desativado,
  // ou turma arquivada depois do login: a assinatura do token confere, mas
  // a sessão acabou. É o mesmo 401 do GET /auth/eu, para a tela voltar ao
  // login — e lá ele recebe o motivo de verdade (403 "turma arquivada").
  private async alunoComSessaoValida(alunoId: string) {
    const aluno = await this.banco.alunos.findUnique({
      where: { ID: alunoId },
      include: { classesprof: { select: { Ativa: true } } },
    });
    if (!aluno || aluno.Ativo === false || aluno.classesprof.Ativa === false) {
      throw new UnauthorizedException({ mensagem: 'Token inválido ou expirado.', codigo: 'TOKEN_INVALIDO' });
    }
    return aluno;
  }

  // O exercício tem de estar atribuído à turma e não pode estar arquivado.
  // Arquivar já apaga as atribuições, então o Ativo aqui é só segurança:
  // as sessões antigas num exercício arquivado ficam, mas nova não nasce.
  private async exigirAtribuido(turmaId: string, exercicioId: string): Promise<void> {
    const atribuicao = await this.banco.atribuicoesprof.findUnique({
      where: { ClassID_ExerciseID: { ClassID: turmaId, ExerciseID: exercicioId } },
      include: { exerciciosprof: { select: { Ativo: true } } },
    });
    if (!atribuicao || !atribuicao.exerciciosprof.Ativo) {
      throw naoEncontrado('Exercício não encontrado nesta turma.');
    }
  }

  // O maior PPM que ele já fez neste exercício (qualquer sessão, concluída
  // ou não, como no mock); 0 se nunca fez.
  private async melhorPpmAnterior(alunoId: string, exercicioId: string): Promise<number> {
    const resultado = await this.banco.sessionsprof.aggregate({
      where: { AlunoID: alunoId, ExerciseID: exercicioId },
      _max: { WPM: true },
    });
    return Number(resultado._max.WPM ?? 0);
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

function sessaoEscolaNaForma(linha: LinhaDeSessao): SessaoEscola {
  return { ...sessaoNaForma(linha), turmaId: linha.ClassID };
}

function sessaoSoloNaForma(linha: Prisma.sessionssoloGetPayload<object>): SessaoSolo {
  return {
    id: linha.ID,
    exerciseId: linha.ExerciseID,
    wpm: Number(linha.WPM ?? 0),
    precisao: Number(linha.Precisao ?? 0),
    tempoSegundos: linha.Tempo_Gasto_Segundos ?? 0,
    acertos: linha.Acertos ?? 0,
    erros: linha.Erros ?? 0,
    concluida: linha.Concluida,
    xpGanho: linha.XPGanho,
    data: linha.Data_Sessao?.toISOString() ?? '',
  };
}

// usuario_id, alunoId e professorId são recusados, e não ignorados:
// ignorado, quem mandou acharia que escolheu de quem é a sessão, e ela
// iria para o dono do token.
function recusarIdDePessoaNoCorpo(corpo: CorpoDaSessao | undefined): void {
  for (const campo of ['usuario_id', 'alunoId', 'professorId'] as const) {
    if (corpo?.[campo] !== undefined) {
      throw dadosInvalidos(`O aluno sai do login: não mande ${campo}.`);
    }
  }
}

function idDoCorpo(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw dadosInvalidos(`Informe ${campo}.`);
  }
  return valor;
}

// Gravados como chegaram do motor da tela: o back só confere que cabem nas
// colunas e fazem sentido (nada negativo, precisão até 100).
function validarMedidas(corpo: CorpoDaSessao | undefined): MedidasValidadas {
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

function naoEncontrado(mensagem: string): NotFoundException {
  return new NotFoundException({ mensagem, codigo: 'NAO_ENCONTRADO' });
}
