// turmas.module.ts
// Grupo "Turmas (professor)" do CONTRATO-API.md. Pronto inteiro:
//   GET /turmas (e ?ativa=false), POST /turmas, GET /turmas/:id,
//   PATCH /turmas/:id (renomear, trocarCapa, arquivar, desarquivar) e
//   POST /turmas/:id/codigo/novo — aqui;
//   as três de /turmas/:id/atribuicoes — no AtribuicoesModule.
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa), que o AutenticacaoModule exporta, e o AlunosModule pela
// lista de alunos com que GET /turmas/:id calcula o ppmMedio.
import { Module } from '@nestjs/common';
import { AlunosModule } from '../alunos/alunos.module.js';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { TurmasController } from './turmas.controller.js';
import { TurmasService } from './turmas.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule, AlunosModule],
  controllers: [TurmasController],
  providers: [TurmasService],
})
export class TurmasModule {}
