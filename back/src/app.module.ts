// app.module.ts
// O módulo raiz: junta o banco e os módulos que têm rota implementada.
//
// Hoje a autenticação, as turmas (menos GET /turmas/:id), as atribuições,
// os alunos da turma e a biblioteca de exercícios. As outras rotas do contrato
// ainda não têm código: estão documentadas no CONTRATO-API.md e no Swagger
// (back/openapi.json), e ganham um módulo aqui quando forem implementadas.
import { Module } from '@nestjs/common';
import { BancoModule } from './banco/banco.module.js';
import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { TurmasModule } from './turmas/turmas.module.js';
import { AtribuicoesModule } from './atribuicoes/atribuicoes.module.js';
import { AlunosModule } from './alunos/alunos.module.js';
import { ExerciciosModule } from './exercicios/exercicios.module.js';

@Module({
  imports: [
    // Importado aqui, e não só nos módulos de rota, para a conexão ser
    // testada na subida (ver BancoService.onModuleInit).
    BancoModule,
    AutenticacaoModule,
    TurmasModule,
    AtribuicoesModule,
    AlunosModule,
    ExerciciosModule,
  ],
})
export class AppModule {}
