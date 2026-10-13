// campanhas.service.ts
// A campanha do Solo (tabela CampanhasSolo), no grupo "Solo" do
// CONTRATO-API.md:
//   GET    /solo/campanha        a campanha do token, ou null
//   POST   /solo/campanha        cria a do token (ou devolve a que existe)
//   GET    /solo/campanhas/:id   uma campanha pelo id, só do dono
//   DELETE /solo/campanhas/:id   apaga, só do dono
//
// As duas primeiras são as que as telas usam. As duas com :id existem no
// contrato, mas nenhuma tela chama: campanha de outra conta responde o
// mesmo 404 de campanha que não existe — um 403 confirmaria que ela existe.
import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { campanhaDoJogador, jogadorDoToken } from './campanha-do-token.js';

// A campanha na forma do tipo Campanha do front (js/nucleo/tipos.ts).
export interface Campanha {
  campanhaId: string;
  jogadorId: string;
  nivelAtual: number;
  xpTotal: number;
}

@Injectable()
export class CampanhasService {
  constructor(private readonly banco: BancoService) {}

  // GET /solo/campanha. null, e não 404, para quem ainda não começou: é o
  // estado de primeira vez do lobby, e estado não é erro (um 404 obrigaria
  // a tela a ler o convite de começar dentro de um catch).
  async atual(identidade: Identidade): Promise<Campanha | null> {
    const campanha = await campanhaDoJogador(this.banco, jogadorDoToken(identidade));
    return campanha ? campanhaNaForma(campanha) : null;
  }

  // POST /solo/campanha. Sem corpo: CampanhaID, NivelAtual e XPTotal são do
  // back, e o JogadorID sai do token. Idempotente: quem já tem campanha
  // recebe a que existe — é isso que deixa o botão "Começar" do lobby seguro
  // contra clique duplo, aba duplicada e F5 no meio do caminho.
  //
  // Quem decide se já existe é o UNIQUE de CampanhasSolo.JogadorID, e não
  // uma consulta antes do INSERT: entre a consulta e o INSERT, outra
  // requisição do mesmo jogador poderia criar a dela. Dois POSTs ao mesmo
  // tempo: um cria, o banco recusa o outro (P2002), e esse outro devolve a
  // campanha que o primeiro criou — os dois recebem 200 com a mesma.
  async criar(identidade: Identidade): Promise<Campanha> {
    const jogadorId = jogadorDoToken(identidade);
    try {
      const nova = await this.banco.campanhassolo.create({
        data: { CampanhaID: randomUUID(), JogadorID: jogadorId, NivelAtual: 1, XPTotal: 0 },
      });
      return campanhaNaForma(nova);
    } catch (erro) {
      // P2002 é o código do Prisma para "violou um UNIQUE".
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) {
        throw erro;
      }
      const existente = await this.banco.campanhassolo.findUniqueOrThrow({ where: { JogadorID: jogadorId } });
      return campanhaNaForma(existente);
    }
  }

  // GET /solo/campanhas/:id. Só o dono lê.
  async obter(identidade: Identidade, id: string): Promise<Campanha> {
    return campanhaNaForma(await this.campanhaDoDono(identidade, id));
  }

  // DELETE /solo/campanhas/:id. Só o dono apaga. É um DELETE de verdade, e
  // não arquivar: o contrato não pede exclusão lógica aqui (pede em
  // categorias e exercícios), e a campanha é só do jogador — não há
  // professor nem relatório de outra pessoa contando com ela. As sessões
  // dela vão junto (SessionsSolo tem ON DELETE CASCADE). Nenhuma tela chama.
  async apagar(identidade: Identidade, id: string): Promise<void> {
    await this.campanhaDoDono(identidade, id);
    await this.banco.campanhassolo.delete({ where: { CampanhaID: id } });
  }

  // A campanha pelo id, se for da conta do token. De outra conta é o mesmo
  // 404 de campanha que não existe.
  private async campanhaDoDono(identidade: Identidade, id: string) {
    const campanha = await this.banco.campanhassolo.findFirst({
      where: { CampanhaID: id, JogadorID: jogadorDoToken(identidade) },
    });
    if (!campanha) {
      throw new NotFoundException({ mensagem: 'Campanha não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    return campanha;
  }
}

// Da linha do banco para a forma do contrato. NivelAtual e XPTotal aceitam
// NULL no banco; o DEFAULT deles é 1 e 0, e é isso que vale sem valor.
export function campanhaNaForma(linha: Prisma.campanhassoloGetPayload<object>): Campanha {
  return {
    campanhaId: linha.CampanhaID,
    jogadorId: linha.JogadorID,
    nivelAtual: linha.NivelAtual ?? 1,
    xpTotal: linha.XPTotal ?? 0,
  };
}
