// exercicios.module.ts
// Grupo "Biblioteca de exercícios (professor)" do CONTRATO-API.md.
// Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas. Rotas que vão morar aqui:
//   GET /exercicios, GET /exercicios/:id, POST /exercicios,
//   PATCH /exercicios/:id, DELETE /exercicios/:id
// Tabela ExerciciosProf: o exercício é do professor, não de uma turma.
import { Module } from '@nestjs/common';
import { ExerciciosController } from './exercicios.controller.js';

@Module({
  controllers: [ExerciciosController],
})
export class ExerciciosModule {}
