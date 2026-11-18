// "A turma tem de ser da conta do token": a pergunta que turmas, alunos e
// atribuições fazem antes de qualquer coisa. Uma função só, para as três
// responderem o mesmo 404.
import { NotFoundException } from '@nestjs/common';
import type { BancoService } from '../banco/banco.service.js';

// A linha de ClassesProf, se houver vínculo em professoresturmas com este
// professor. É a única verificação de propriedade de turma do back. Se não existe ou é de
// outra conta, o mesmo 404: um 403 confirmaria a quem tenta ids que
// aquela turma existe.
export async function turmaDaConta(banco: BancoService, professorId: string, turmaId: string) {
  const turma = await banco.classesprof.findFirst({
    where: { ClassID: turmaId, professoresturmas: { ProfessorID: professorId } },
  });
  if (!turma) {
    throw new NotFoundException({ mensagem: 'Turma não encontrada.', codigo: 'NAO_ENCONTRADO' });
  }
  return turma;
}
