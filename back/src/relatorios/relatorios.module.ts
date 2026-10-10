// relatorios.module.ts
// Grupo "Relatórios (professor)" do CONTRATO-API.md. Pronto inteiro:
//   GET /turmas/:id/relatorio, GET /turmas/:id/relatorio/alunos,
//   GET /turmas/:id/relatorio/exercicios,
//   GET /turmas/:id/alunos/:alunoId/sessoes
//
// Importa o AlunosModule e o AtribuicoesModule para reaproveitar as linhas
// que eles já montam (a do aluno e a da atribuição): o relatório só
// acrescenta colunas, e as duas telas nunca discordam no que é igual.
import { Module } from '@nestjs/common';
import { AlunosModule } from '../alunos/alunos.module.js';
import { AtribuicoesModule } from '../atribuicoes/atribuicoes.module.js';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { RelatoriosController } from './relatorios.controller.js';
import { RelatoriosService } from './relatorios.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule, AlunosModule, AtribuicoesModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
