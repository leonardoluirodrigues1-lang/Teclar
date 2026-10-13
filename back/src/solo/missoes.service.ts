// missoes.service.ts
// As lições do Solo (tabela ExerciciosSolo), no grupo "Solo" do
// CONTRATO-API.md:
//   GET /solo/missoes       as 76 lições, na ordem do percurso, sem o texto
//   GET /solo/missoes/:id   uma lição, com o texto
//
// As lições são conteúdo semeado, iguais para todo mundo: não existe lição
// "de outra conta". Nenhuma vem bloqueada — ExerciciosSolo.NivelMinimo não
// é lido (está em `naoUsadas`, no api.contrato.ts) —, e quem agrupa por
// nível é a tela.
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { campanhaDoToken } from './campanha-do-token.js';

// Uma lição na forma do tipo Missao do front (js/nucleo/tipos.ts).
export interface Missao {
  exerciseId: string;
  ordem: number;
  nivel: number;
  titulo: string;
  dificuldade: string;
  repeticoes: number;
  tempoLimiteSegundos: number;
  tamanhoCaracteres: number;
}

export interface MissaoDetalhe extends Missao {
  texto: string;
}

type LinhaDeLicao = Prisma.exerciciossoloGetPayload<object>;

@Injectable()
export class MissoesService {
  constructor(private readonly banco: BancoService) {}

  // GET /solo/missoes. Só para quem já tem campanha (o contrato pede o 404
  // de "ainda não começou"). O contrato diz que a rota aceita filtros na
  // query string, mas não diz quais, e nenhuma tela manda: a query é
  // ignorada e vêm sempre todas.
  async listar(identidade: Identidade): Promise<Missao[]> {
    await campanhaDoToken(this.banco, identidade);
    const licoes = await this.banco.exerciciossolo.findMany({
      where: { Ativo: true },
      orderBy: { Ordem: 'asc' },
    });
    // O texto é lido do banco só para contar os caracteres: na resposta ele
    // não vai. Seriam uns 30 KB que nenhum cartão do percurso mostra.
    return licoes.map(missaoNaForma);
  }

  // GET /solo/missoes/:id. Qualquer token válido, de conta ou de aluno: o
  // contrato abre esta rota a todos porque a lição não é de ninguém. Lição
  // desativada (Ativo = false) é tratada como inexistente.
  async obter(id: string): Promise<MissaoDetalhe> {
    const licao = await this.banco.exerciciossolo.findFirst({ where: { ExerciseID: id, Ativo: true } });
    if (!licao) {
      throw new NotFoundException({ mensagem: 'Lição não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    return { ...missaoNaForma(licao), texto: licao.Texto };
  }
}

function missaoNaForma(linha: LinhaDeLicao): Missao {
  return {
    exerciseId: linha.ExerciseID,
    ordem: linha.Ordem,
    nivel: linha.Nivel,
    titulo: linha.Titulo,
    dificuldade: linha.Dificuldade,
    repeticoes: linha.Repeticoes,
    tempoLimiteSegundos: linha.Tempo_Limite_Segundos ?? 0,
    // Contado aqui porque o back é quem tem o texto; é a mesma conta do
    // front (texto.length, em js/nucleo/licoes.ts).
    tamanhoCaracteres: linha.Texto.length,
  };
}
