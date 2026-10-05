// administracao.module.ts
// Grupo "Administração" do CONTRATO-API.md. Rotas declaradas e no Swagger,
// respondendo 501 até serem implementadas.
// Rotas que vão morar aqui:
//   GET, POST, PATCH e DELETE /categorias, GET e PUT /parametros
// Tabelas Categorias e Configuracoes. Os valores são semeados pelo
// DB_Teclar_v7.sql; a escrita (que exige administrador) está fora do
// escopo desta entrega.
import { Module } from '@nestjs/common';
import { AdministracaoController } from './administracao.controller.js';

@Module({
  controllers: [AdministracaoController],
})
export class AdministracaoModule {}
