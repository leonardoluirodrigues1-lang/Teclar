// A regra de liberação das atividades, igual para o Solo e para o aluno:
// só a primeira não concluída da sequência fica aberta; as concluídas podem
// ser refeitas à vontade; as outras ficam bloqueadas.
//
// "Concluída" = ao menos uma sessão com Concluida = true: tempo esgotado não
// libera a seguinte. Tudo sai das sessões que já existem, sem coluna nova.
import { ForbiddenException } from '@nestjs/common';
import type { BancoService } from '../banco/banco.service.js';

export interface Sequencia {
  concluidas: Set<string>;
  // null: tudo concluído.
  proxima: string | null;
}

export function proximaLiberada(idsEmOrdem: string[], concluidas: Set<string>): string | null {
  return idsEmOrdem.find((id) => !concluidas.has(id)) ?? null;
}

export function estaBloqueada(id: string, { concluidas, proxima }: Sequencia): boolean {
  return !concluidas.has(id) && id !== proxima;
}

export function exigirLiberada(id: string, sequencia: Sequencia): void {
  if (estaBloqueada(id, sequencia)) {
    throw new ForbiddenException({
      mensagem: 'Esta atividade ainda está bloqueada: conclua a anterior primeiro.',
      codigo: 'ATIVIDADE_BLOQUEADA',
    });
  }
}

// A sequência do Solo é a do caminho: agrupada por nível, e não pelo número
// da lição (a 49 vem logo depois da 8, dentro do nível 1). É a mesma ordem de
// ordemDoPercurso, em js/utils/percurso.ts.
export async function sequenciaDoSolo(banco: BancoService, campanhaId: string): Promise<Sequencia> {
  const licoes = await banco.exerciciossolo.findMany({
    where: { Ativo: true },
    select: { ExerciseID: true, Nivel: true, Ordem: true },
  });
  const sessoes = await banco.sessionssolo.findMany({
    where: { CampanhaID: campanhaId, Concluida: true },
    select: { ExerciseID: true },
  });
  const concluidas = new Set(sessoes.map((sessao) => sessao.ExerciseID));
  const ids = ordemDoPercurso(licoes).map((licao) => licao.ExerciseID);
  return { concluidas, proxima: proximaLiberada(ids, concluidas) };
}

function ordemDoPercurso<T extends { Nivel: number; Ordem: number }>(licoes: T[]): T[] {
  const primeiraDoNivel = new Map<number, number>();
  for (const { Nivel, Ordem } of licoes) {
    primeiraDoNivel.set(Nivel, Math.min(Ordem, primeiraDoNivel.get(Nivel) ?? Ordem));
  }
  return [...licoes].sort(
    (a, b) => primeiraDoNivel.get(a.Nivel)! - primeiraDoNivel.get(b.Nivel)! || a.Ordem - b.Ordem,
  );
}

// Os exercícios da sala, na ordem dela. Exercício arquivado ou com a
// atribuição removida não vem, e por isso sai da sequência; o atribuído
// depois entra no fim.
export function atribuicoesDaSala(banco: BancoService, turmaId: string) {
  return banco.atribuicoesprof.findMany({
    where: { ClassID: turmaId, exerciciosprof: { Ativo: true } },
    include: { exerciciosprof: true },
    // Atribuir vários exercícios de uma vez grava todos no mesmo segundo
    // (Data_Atribuicao é DATETIME, sem milissegundo): no empate, o título
    // em ordem alfabética, e o id para dois títulos iguais.
    orderBy: [{ Data_Atribuicao: 'asc' }, { exerciciosprof: { Titulo: 'asc' } }, { ExerciseID: 'asc' }],
  });
}

export async function sequenciaDaSala(banco: BancoService, turmaId: string, alunoId: string): Promise<Sequencia> {
  const atribuicoes = await atribuicoesDaSala(banco, turmaId);
  const sessoes = await banco.sessionsprof.findMany({
    where: { AlunoID: alunoId, ClassID: turmaId, Concluida: true },
    select: { ExerciseID: true },
  });
  const concluidas = new Set(sessoes.map((sessao) => sessao.ExerciseID));
  const ids = atribuicoes.map((atribuicao) => atribuicao.ExerciseID);
  return { concluidas, proxima: proximaLiberada(ids, concluidas) };
}
