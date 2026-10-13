// administracao.module.ts
// Grupo "Administração" do CONTRATO-API.md. Pronto inteiro: as quatro rotas
// de /categorias e as duas de /parametros. Quem é administrador diz a
// coluna Users.Administrador (banco v9; ver administrador-do-token.ts).
//
// Importa o AutenticacaoModule pelo GuardaDoToken (e o JwtService de que
// ele precisa).
import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { BancoModule } from '../banco/banco.module.js';
import { AdministracaoController } from './administracao.controller.js';
import { CategoriasService } from './categorias.service.js';
import { ParametrosService } from './parametros.service.js';

@Module({
  imports: [BancoModule, AutenticacaoModule],
  controllers: [AdministracaoController],
  providers: [CategoriasService, ParametrosService],
})
export class AdministracaoModule {}
