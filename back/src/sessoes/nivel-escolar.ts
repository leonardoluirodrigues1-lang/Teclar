// O nível escolar do aluno numa turma: 1 + floor(licoes / K), em que
// licoes = exercícios DIFERENTES concluídos nesta turma (inclusive de
// atribuição já retirada) e K = Configuracoes.licoes_por_nivel. Um lugar só
// para o GET meu-desempenho e o POST /sessoes darem o mesmo número.
import type { BancoService } from '../banco/banco.service.js';

export interface NivelEscolar {
  licoes: number;
  nivelAtual: number;
  // Lições distintas em que o próximo nível começa (nivelAtual * K).
  proximoMarco: number;
}

export function nivelDe(licoes: number, porNivel: number): NivelEscolar {
  const nivelAtual = 1 + Math.floor(licoes / porNivel);
  return { licoes, nivelAtual, proximoMarco: nivelAtual * porNivel };
}

// Os exercícios diferentes que ele já concluiu nesta turma.
export async function licoesConcluidas(banco: BancoService, alunoId: string, turmaId: string): Promise<Set<string>> {
  const linhas = await banco.sessionsprof.findMany({
    where: { AlunoID: alunoId, ClassID: turmaId, Concluida: true },
    select: { ExerciseID: true },
    distinct: ['ExerciseID'],
  });
  return new Set(linhas.map((linha) => linha.ExerciseID));
}

// K. Sem a linha (ou inválida) o banco está incompleto: erro claro, como o
// xp_por_nivel do Solo.
export async function lerLicoesPorNivel(banco: BancoService): Promise<number> {
  const linha = await banco.configuracoes.findUnique({ where: { Chave: 'licoes_por_nivel' } });
  const valor = Number(linha?.Valor);
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error('Configuracoes.licoes_por_nivel ausente ou inválido. Veja o DB_Teclar_v10.sql.');
  }
  return valor;
}
