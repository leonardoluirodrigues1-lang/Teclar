// exercicios.module.ts
// Grupo "Biblioteca de exercícios (professor)" do CONTRATO-API.md. Pronto
// inteiro: GET /exercicios, GET /exercicios/:id?turma=, POST /exercicios,
// PATCH /exercicios/:id, DELETE /exercicios/:id (que arquiva).
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { ExerciciosController } from './exercicios.controller.js';
import { ExerciciosService } from './exercicios.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [ExerciciosController],
  providers: [ExerciciosService],
})
export class ExerciciosModule {}
