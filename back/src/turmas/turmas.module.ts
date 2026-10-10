// turmas.module.ts
// Grupo "Turmas (professor)" do CONTRATO-API.md.
// Pronto: GET /turmas (e ?ativa=false), POST /turmas, PATCH /turmas/:id
//         (renomear, trocarCapa, arquivar, desarquivar),
//         POST /turmas/:id/codigo/novo
// Falta:  GET /turmas/:id e as três de /turmas/:id/atribuicoes
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa), que o AutenticacaoModule exporta.
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { TurmasController } from './turmas.controller.js';
import { TurmasService } from './turmas.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [TurmasController],
  providers: [TurmasService],
})
export class TurmasModule {}
