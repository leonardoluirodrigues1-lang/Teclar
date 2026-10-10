// atribuicoes.module.ts
// As três rotas de atribuição do grupo "Turmas (professor)" do
// CONTRATO-API.md: GET, POST /turmas/:id/atribuicoes e
// DELETE /turmas/:id/atribuicoes/:exercicioId.
//
// Módulo à parte do TurmasModule porque mexe em outra tabela
// (AtribuicoesProf) e junta turma com exercício; a URL é que fica debaixo
// de /turmas.
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { AtribuicoesController } from './atribuicoes.controller.js';
import { AtribuicoesService } from './atribuicoes.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [AtribuicoesController],
  providers: [AtribuicoesService],
  // Exportado para o RelatoriosModule reaproveitar a linha da atribuição.
  exports: [AtribuicoesService],
})
export class AtribuicoesModule {}
