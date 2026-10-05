// app.module.ts
// O módulo raiz: junta o banco e um módulo por grupo de rotas do
// CONTRATO-API.md (na raiz do repositório). Os módulos de rota ainda estão
// vazios; cada um diz no topo quais rotas vai receber.
import { Module } from '@nestjs/common';
import { BancoModule } from './banco/banco.module.js';
import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { ContaModule } from './conta/conta.module.js';
import { SoloModule } from './solo/solo.module.js';
import { TurmasModule } from './turmas/turmas.module.js';
import { AlunosEConvitesModule } from './alunos-e-convites/alunos-e-convites.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';
import { ExerciciosModule } from './exercicios/exercicios.module.js';
import { SessoesModule } from './sessoes/sessoes.module.js';
import { AlunoModule } from './aluno/aluno.module.js';
import { AdministracaoModule } from './administracao/administracao.module.js';

@Module({
  imports: [
    // Importado aqui, e não só nos módulos de rota, para a conexão ser
    // testada na subida mesmo enquanto nenhum módulo usa o banco.
    BancoModule,
    // Na ordem dos grupos do contrato.
    AutenticacaoModule,
    ContaModule,
    SoloModule,
    TurmasModule,
    AlunosEConvitesModule,
    RelatoriosModule,
    ExerciciosModule,
    SessoesModule,
    AlunoModule,
    AdministracaoModule,
  ],
})
export class AppModule {}
