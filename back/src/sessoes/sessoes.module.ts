// sessoes.module.ts
// Grupo "Sessões" do CONTRATO-API.md. Pronto inteiro: POST /sessoes e
// GET /sessoes/:id.
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { SessoesController } from './sessoes.controller.js';
import { SessoesService } from './sessoes.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [SessoesController],
  providers: [SessoesService],
})
export class SessoesModule {}
