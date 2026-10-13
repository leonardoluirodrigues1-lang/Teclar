// ranking.service.ts
// GET /turmas/:turmaId/ranking (CONTRATO-API.md, grupo "Aluno"): o ranking da
// turma visto pelo PRÓPRIO aluno logado. Vem JÁ ORDENADO E PONTUADO: a tela
// só exibe.
//
// A ANONIMIZAÇÃO É AQUI, no servidor: do 4º lugar em diante o nome sai
// null, menos na linha do próprio aluno. Se a tela é que escondesse, o nome
// de todo colega estaria na resposta, à vista de qualquer um que abrisse a
// aba de rede do navegador.
//
// Para cada aluno ATIVO da turma, sobre as sessões dele nela:
//   licoes        exercícios distintos concluídos
//   ritmo         PPM médio das concluídas, inteiro; null sem nenhuma
//   diasSeguidos  dias seguidos com sessão, terminando hoje ou ontem; senão 0
//   pontos        licoes * 20 + (ritmo ?? 0) + diasSeguidos * 5
// Lição de exercício arquivado continua contando: o que o aluno fez fica.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { contarDiasSeguidos } from '../sessoes/dias-seguidos.js';
import { mediaInteira } from '../sessoes/sessao-escola.js';

// Uma linha da resposta (LinhaDoRanking no front).
export interface LinhaDoRanking {
  posicao: number;
  nome: string | null;
  voce: boolean;
  licoes: number;
  ritmo: number | null;
  diasSeguidos: number;
  pontos: number;
}

// Os números de um aluno, antes de ordenar e anonimizar.
interface Pontuacao {
  alunoId: string;
  nome: string;
  licoes: number;
  ritmo: number | null;
  diasSeguidos: number;
  pontos: number;
}

// Só do 1º ao 3º lugar o nome aparece para os colegas.
const LUGARES_COM_NOME = 3;
const PONTOS_POR_LICAO = 20;
const PONTOS_POR_DIA_SEGUIDO = 5;

// O que a pontuação precisa de cada sessão.
interface SessaoParaPontuar {
  ExerciseID: string;
  WPM: unknown;
  Concluida: boolean;
  Data_Sessao: Date | null;
}

@Injectable()
export class RankingService {
  constructor(private readonly banco: BancoService) {}

  async daTurma(identidade: Identidade, turmaId: string): Promise<LinhaDoRanking[]> {
    if (identidade.tipo !== 'aluno') {
      throw new ForbiddenException({ mensagem: 'Rota só para alunos.', codigo: 'TIPO_INVALIDO' });
    }
    // O aluno sai do token. Na v8 ele está numa turma só (Alunos.ClassID):
    // :turmaId que não é a dele é 404, e não 403 — o 403 diria "essa turma
    // existe, só não é sua".
    const aluno = await this.banco.alunos.findUnique({ where: { ID: identidade.id } });
    if (!aluno || aluno.ClassID !== turmaId) {
      throw new NotFoundException({ mensagem: 'Turma não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }

    const pontuacoes = await this.pontuarAlunos(turmaId);
    pontuacoes.sort(compararPontuacoes);
    return pontuacoes.map((pontuacao, indice) => linhaVistaPor(aluno.ID, pontuacao, indice));
  }

  // Os números de cada aluno ativo da turma, inclusive quem nunca treinou
  // (zero lições, ritmo null, zero dias).
  private async pontuarAlunos(turmaId: string): Promise<Pontuacao[]> {
    const membros = await this.banco.alunos.findMany({ where: { ClassID: turmaId, Ativo: true } });
    const sessoes = await this.banco.sessionsprof.findMany({
      where: { ClassID: turmaId, alunos: { Ativo: true } },
      select: { AlunoID: true, ExerciseID: true, WPM: true, Concluida: true, Data_Sessao: true },
    });
    return membros.map((membro) =>
      pontuar(
        membro.ID,
        membro.Nome,
        sessoes.filter((sessao) => sessao.AlunoID === membro.ID),
      ),
    );
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

function pontuar(alunoId: string, nome: string, sessoes: SessaoParaPontuar[]): Pontuacao {
  const concluidas = sessoes.filter((sessao) => sessao.Concluida);
  const licoes = new Set(concluidas.map((sessao) => sessao.ExerciseID)).size;
  const ritmo = mediaInteira(concluidas.map((sessao) => Number(sessao.WPM ?? 0)));
  // A conta dos dias seguidos é a mesma do resumo do aluno
  // (sessoes/dias-seguidos.ts).
  const diasSeguidos = contarDiasSeguidos(sessoes);
  const pontos = licoes * PONTOS_POR_LICAO + (ritmo ?? 0) + diasSeguidos * PONTOS_POR_DIA_SEGUIDO;
  return { alunoId, nome, licoes, ritmo, diasSeguidos, pontos };
}

// A ordem do contrato: pontos, depois mais lições, depois mais dias. O
// contrato para aí; o nome, em último, só garante que dois empates
// perfeitos saiam sempre na mesma ordem, e não na que o banco devolveu.
function compararPontuacoes(a: Pontuacao, b: Pontuacao): number {
  return (
    b.pontos - a.pontos ||
    b.licoes - a.licoes ||
    b.diasSeguidos - a.diasSeguidos ||
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

// A linha como ESTE aluno a vê: o nome dos colegas só nos três primeiros
// lugares; o dele, sempre.
function linhaVistaPor(alunoId: string, pontuacao: Pontuacao, indice: number): LinhaDoRanking {
  const voce = pontuacao.alunoId === alunoId;
  const noPodio = indice < LUGARES_COM_NOME;
  return {
    posicao: indice + 1,
    nome: voce || noPodio ? pontuacao.nome : null,
    voce,
    licoes: pontuacao.licoes,
    ritmo: pontuacao.ritmo,
    diasSeguidos: pontuacao.diasSeguidos,
    pontos: pontuacao.pontos,
  };
}
