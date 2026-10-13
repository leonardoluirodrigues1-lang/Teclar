// solo.module.ts
// Grupo "Solo" do CONTRATO-API.md. Pronto inteiro: a campanha
// (campanhas.service.ts), as lições (missoes.service.ts) e o progresso —
// sessões, XP, histórico, indicadores e estatísticas (progresso.service.ts).
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { CampanhasService } from './campanhas.service.js';
import { MissoesService } from './missoes.service.js';
import { ProgressoService } from './progresso.service.js';
import { SoloController } from './solo.controller.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [SoloController],
  providers: [CampanhasService, MissoesService, ProgressoService],
})
export class SoloModule {}
