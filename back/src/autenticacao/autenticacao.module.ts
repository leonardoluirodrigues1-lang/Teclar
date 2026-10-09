// autenticacao.module.ts
// Grupo "Autenticação" do CONTRATO-API.md.
// Pronto: POST /auth/login, POST /auth/cadastro, GET /auth/eu,
//         POST /auth/logout
//
// Também é dono do GuardaDoToken, que as outras rotas vão usar. Exporta o
// guard e o JwtModule (o guard precisa do JwtService) para um módulo que
// importar este poder aplicá-lo.
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BancoModule } from '../banco/banco.module.js';
import { AutenticacaoController } from './autenticacao.controller.js';
import { AutenticacaoService } from './autenticacao.service.js';
import { GuardaDoToken } from './guarda-do-token.js';
import { VALIDADE_DO_TOKEN, segredoDoJwt } from './token.js';

@Module({
  imports: [
    BancoModule,
    // registerAsync, e não register: com register o segredo seria lido no
    // momento em que este arquivo é importado. Hoje daria certo, porque o
    // main.ts carrega o .env no primeiro import — mas o login dependeria da
    // ordem dos imports de outro arquivo. A fábrica só roda quando o Nest
    // monta o módulo, e aí o .env com certeza já foi lido.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: segredoDoJwt(),
        signOptions: { expiresIn: VALIDADE_DO_TOKEN },
      }),
    }),
  ],
  controllers: [AutenticacaoController],
  providers: [AutenticacaoService, GuardaDoToken],
  exports: [GuardaDoToken, JwtModule],
})
export class AutenticacaoModule {}
