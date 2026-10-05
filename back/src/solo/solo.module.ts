// solo.module.ts
// Grupo "Solo" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   GET e POST /solo/campanha, GET e DELETE /solo/campanhas/:id,
//   GET /solo/missoes, GET /solo/missoes/:id, POST /solo/sessoes,
//   GET /solo/historico, GET /solo/indicadores, GET /solo/estatisticas
// O mundo Solo é da CONTA (tabelas CampanhasSolo, ExerciciosSolo e
// SessionsSolo).
import { Module } from '@nestjs/common';
import { SoloController } from './solo.controller.js';

@Module({
  controllers: [SoloController],
})
export class SoloModule {}
