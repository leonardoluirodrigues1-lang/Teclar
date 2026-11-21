// Apaga contas (Users) e tudo o que pende delas, numa transação já aberta.
// Usado pelo seed (a demonstração) e pelo limpar-testes (as contas que as
// suítes criam). Um lugar só sabe a ordem certa.
//
// Filhas antes das mães: nem toda FK tem CASCADE (alunosturmas ->
// classesprof e professoresturmas -> users não têm), e a ordem explícita
// deixa à vista o que depende do quê. As lições do Solo (exerciciossolo)
// nunca saem daqui: são um catálogo de todos.
import type { PrismaClient } from '../src/generated/prisma/client.js';

export type Transacao = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Ids que também saem mesmo sem vínculo com as contas (o seed passa os
// seus, para uma linha órfã da demo não quebrar o INSERT seguinte).
export interface IdsAMais {
  turmas?: string[];
  exercicios?: string[];
  alunos?: string[];
  campanhas?: string[];
}

export interface Apagados {
  contas: number;
  turmas: number;
  alunos: number;
  exercicios: number;
  sessoesEscola: number;
  campanhas: number;
  sessoesSolo: number;
}

export async function apagarContas(tx: Transacao, contas: string[], aMais: IdsAMais = {}): Promise<Apagados> {
  const ids = <T,>(linhas: T[], campo: keyof T) => linhas.map((linha) => linha[campo] as string);

  const turmas = ids(
    await tx.classesprof.findMany({
      where: { OR: [{ ClassID: { in: aMais.turmas ?? [] } }, { professoresturmas: { ProfessorID: { in: contas } } }] },
      select: { ClassID: true },
    }),
    'ClassID',
  );
  const exercicios = ids(
    await tx.exerciciosprof.findMany({
      where: { OR: [{ ExerciseID: { in: aMais.exercicios ?? [] } }, { ProfessorID: { in: contas } }] },
      select: { ExerciseID: true },
    }),
    'ExerciseID',
  );
  const matriculados = ids(await tx.alunosturmas.findMany({ where: { ClassID: { in: turmas } }, select: { AlunoID: true } }), 'AlunoID');
  const alunos = [...new Set([...(aMais.alunos ?? []), ...matriculados])];
  const campanhas = ids(
    await tx.campanhassolo.findMany({
      where: { OR: [{ CampanhaID: { in: aMais.campanhas ?? [] } }, { JogadorID: { in: contas } }] },
      select: { CampanhaID: true },
    }),
    'CampanhaID',
  );

  const sessoesEscola = await tx.sessionsprof.deleteMany({ where: { OR: [{ ClassID: { in: turmas } }, { ExerciseID: { in: exercicios } }] } });
  await tx.atribuicoesprof.deleteMany({ where: { OR: [{ ClassID: { in: turmas } }, { ExerciseID: { in: exercicios } }] } });
  await tx.alunosturmas.deleteMany({ where: { OR: [{ ClassID: { in: turmas } }, { AlunoID: { in: alunos } }] } });
  const alunosApagados = await tx.alunos.deleteMany({ where: { ID: { in: alunos } } });
  await tx.professoresturmas.deleteMany({ where: { OR: [{ ClassID: { in: turmas } }, { ProfessorID: { in: contas } }] } });
  const turmasApagadas = await tx.classesprof.deleteMany({ where: { ClassID: { in: turmas } } });
  const exerciciosApagados = await tx.exerciciosprof.deleteMany({ where: { ExerciseID: { in: exercicios } } });
  const sessoesSolo = await tx.sessionssolo.deleteMany({ where: { CampanhaID: { in: campanhas } } });
  const campanhasApagadas = await tx.campanhassolo.deleteMany({ where: { CampanhaID: { in: campanhas } } });
  const contasApagadas = await tx.users.deleteMany({ where: { ID: { in: contas } } });

  return {
    contas: contasApagadas.count,
    turmas: turmasApagadas.count,
    alunos: alunosApagados.count,
    exercicios: exerciciosApagados.count,
    sessoesEscola: sessoesEscola.count,
    campanhas: campanhasApagadas.count,
    sessoesSolo: sessoesSolo.count,
  };
}
