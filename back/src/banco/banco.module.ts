// banco.module.ts
// Empacota o BancoService para o Nest. Um módulo de rota que precisar do
// banco põe BancoModule no seu "imports" e recebe o BancoService no
// construtor.
import { Module } from '@nestjs/common';
import { BancoService } from './banco.service.js';

@Module({
  providers: [BancoService],
  exports: [BancoService],
})
export class BancoModule {}
