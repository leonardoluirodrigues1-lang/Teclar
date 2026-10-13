// campanha-do-token.ts
// As duas perguntas que quase toda rota do Solo faz antes de qualquer
// coisa: "quem pede é uma CONTA?" e "qual é a campanha dela?". Ficam num
// lugar só para todas responderem o mesmo 403 e o mesmo 404.
//
// O mundo Solo é da conta (Users). Um jogador tem UMA campanha, e ela sai
// do token: nenhuma rota usada pelas telas recebe id de campanha — com id
// na URL ou no corpo, dava para ler o histórico ou gravar XP na campanha
// de outra pessoa.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import type { BancoService } from '../banco/banco.service.js';

// O id da conta do token (o JogadorID), ou 403 TIPO_INVALIDO se o token é
// de aluno. Aluno não tem Solo: ele vive dentro da turma.
export function jogadorDoToken(identidade: Identidade): string {
  if (identidade.tipo !== 'conta') {
    throw new ForbiddenException({ mensagem: 'O Solo é da conta logada, não do aluno.', codigo: 'TIPO_INVALIDO' });
  }
  return identidade.id;
}

// A campanha do jogador, ou null se ele ainda não começou. "Um jogador,
// uma campanha" é garantido pelo banco (UNIQUE em
// CampanhasSolo.JogadorID, banco v9), por isso a busca é pelo JogadorID.
export function campanhaDoJogador(banco: BancoService, jogadorId: string) {
  return banco.campanhassolo.findUnique({ where: { JogadorID: jogadorId } });
}

// A campanha do token, para as rotas que precisam dela (missões, sessões,
// histórico, indicadores, estatísticas). Sem campanha é 404: a tela manda
// para o lobby antes de chegar nelas, então isto só protege a rota. Só
// GET /solo/campanha responde null, porque lá a ausência é o estado de
// primeira vez do lobby.
export async function campanhaDoToken(banco: BancoService, identidade: Identidade) {
  const campanha = await campanhaDoJogador(banco, jogadorDoToken(identidade));
  if (!campanha) {
    throw new NotFoundException({ mensagem: 'Você ainda não começou o Solo.', codigo: 'NAO_ENCONTRADO' });
  }
  return campanha;
}
