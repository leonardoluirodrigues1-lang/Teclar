// app.module.ts
// O módulo raiz: junta o banco e os módulos que têm rota implementada.
//
// Hoje a autenticação (login, cadastro, eu, logout) e parte das turmas
// (listar, criar, PATCH, código novo). As outras rotas do contrato
// ainda não têm código: estão documentadas no CONTRATO-API.md e no Swagger
// (back/openapi.json), e ganham um módulo aqui quando forem implementadas.
import { Module } from '@nestjs/common';
import { BancoModule } from './banco/banco.module.js';
import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { TurmasModule } from './turmas/turmas.module.js';

@Module({
  imports: [
    // Importado aqui, e não só nos módulos de rota, para a conexão ser
    // testada na subida (ver BancoService.onModuleInit).
    BancoModule,
    AutenticacaoModule,
    TurmasModule,
  ],
})
export class AppModule {}
