// professor-do-token.ts
// As duas regras de identidade que toda rota do PROFESSOR repete (turmas,
// alunos, exercícios, atribuições). Ficam num lugar só para as quatro não
// divergirem na mensagem nem no código de erro.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Identidade } from './token.js';

// O id da conta do token, ou 403 TIPO_INVALIDO se o token é de aluno.
// O id que sai daqui é o ProfessorID: nenhuma rota confia em id mandado
// pela tela.
export function professorDoToken(identidade: Identidade): string {
  if (identidade.tipo !== 'conta') {
    throw new ForbiddenException({ mensagem: 'Rota só para professores.', codigo: 'TIPO_INVALIDO' });
  }
  return identidade.id;
}

// professorId no corpo é RECUSADO, e não ignorado (como o usuario_id do
// POST /sessoes): ignorar em silêncio faria quem mandou achar que escolheu
// o professor.
export function recusarProfessorIdNoCorpo(corpo: { professorId?: unknown } | undefined): void {
  if (corpo?.professorId !== undefined) {
    throw new BadRequestException({
      mensagem: 'O professor sai do login: não mande professorId.',
      codigo: 'DADOS_INVALIDOS',
    });
  }
}
