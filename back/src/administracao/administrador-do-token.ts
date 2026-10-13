// administrador-do-token.ts
// "Quem pede é administrador?": a pergunta das quatro rotas de escrita da
// Administração (POST, PATCH e DELETE /categorias e PUT /parametros).
//
// Administrador é a conta com Users.Administrador = TRUE (banco v9). A
// coluna é lida do banco a cada pedido, e não guardada no token: tirar o
// papel de alguém vale na hora, sem esperar o token de 8 horas vencer.
import { NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import type { BancoService } from '../banco/banco.service.js';

// Conta comum ou aluno: 404, como se a rota não existisse. Um 403 diria
// "esta rota existe e alguém aqui pode usá-la" — e para quem não é
// administrador, estas rotas simplesmente não existem.
export async function exigirAdministrador(banco: BancoService, identidade: Identidade): Promise<void> {
  if (identidade.tipo !== 'conta') {
    throw naoEncontrado();
  }
  const conta = await banco.users.findUnique({ where: { ID: identidade.id }, select: { Administrador: true } });
  if (!conta?.Administrador) {
    throw naoEncontrado();
  }
}

function naoEncontrado(): NotFoundException {
  return new NotFoundException({ mensagem: 'Recurso não encontrado.', codigo: 'NAO_ENCONTRADO' });
}
