// app.module.ts
// O módulo raiz: junta o banco e os módulos que têm rota implementada.
//
// Todas as rotas do contrato (CONTRATO-API.md) têm módulo: autenticação,
// Solo, turmas, atribuições, alunos da turma, biblioteca de exercícios,
// sessões, relatórios, o próprio aluno (com o ranking à parte) e
// administração.
import { Module } from '@nestjs/common';
import { BancoModule } from './banco/banco.module.js';
import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { TurmasModule } from './turmas/turmas.module.js';
import { AtribuicoesModule } from './atribuicoes/atribuicoes.module.js';
import { AlunosModule } from './alunos/alunos.module.js';
import { ExerciciosModule } from './exercicios/exercicios.module.js';
import { SessoesModule } from './sessoes/sessoes.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { RankingModule } from './ranking/ranking.module.js';
import { SoloModule } from './solo/solo.module.js';
import { AlunoModule } from './aluno/aluno.module.js';
import { AdministracaoModule } from './administracao/administracao.module.js';

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
    SessoesModule,
    RelatoriosModule,
    RankingModule,
    SoloModule,
    AlunoModule,
    AdministracaoModule,
  ],
})
export class AppModule {}
