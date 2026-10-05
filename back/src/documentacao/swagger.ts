// swagger.ts
// Monta a documentação OpenAPI (Swagger) e a serve em /api/docs.
// O JSON cru do OpenAPI fica em /api/docs-json (para importar no Postman,
// por exemplo).
//
// As seções do Swagger são os grupos do CONTRATO-API.md, na mesma ordem e
// com a mesma introdução. O conteúdo de cada rota vem do @Documentar, nos
// controllers.
import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { CONTRATO, GRUPOS } from './contrato.gerado.js';

// O SwaggerModule não usa o prefixo global (/api) das rotas, então o
// caminho vai escrito inteiro.
const CAMINHO_DA_DOCUMENTACAO = 'api/docs';

export function montarSwagger(app: INestApplication): void {
  const construtor = new DocumentBuilder()
    .setTitle('TECLAR — API')
    .setDescription(
      'Gerada do mesmo contrato que o CONTRATO-API.md (js/nucleo/api.ts). ' +
        'Rotas marcadas "(ainda não implementada)" respondem 501 por enquanto.\n\n' +
        'Para testar uma rota com cadeado: faça o POST /api/auth/login, copie o ' +
        '"token" da resposta e cole em **Authorize** (sem a palavra Bearer).',
    )
    .setVersion('v7')
    .addBearerAuth();

  // Uma seção (tag) por grupo, com a introdução do grupo como descrição.
  // Declaradas aqui, e não só pelo @ApiTags de cada rota, para o Swagger
  // seguir a ordem do contrato.
  for (const grupo of GRUPOS) {
    construtor.addTag(grupo.nome, grupo.descricao);
  }
  const configuracao = construtor.build();

  const documento = SwaggerModule.createDocument(app, configuracao);
  conferirRotasDoContrato(documento);
  SwaggerModule.setup(CAMINHO_DA_DOCUMENTACAO, app, documento);
}

// Toda rota do contrato tem de estar no documento. Se um controller
// esquecer uma, o aviso sai na subida — senão ela sumiria do Swagger sem
// ninguém notar, e a entrega diria "documentação completa" sem estar.
function conferirRotasDoContrato(documento: OpenAPIObject): void {
  const faltando = Object.entries(CONTRATO).filter(([, rota]) => {
    // "/turmas/:id" no contrato é "/api/turmas/{id}" no OpenAPI.
    const caminho = '/api' + rota.caminho.replace(/:(\w+)/g, '{$1}');
    const metodo = rota.metodo.toLowerCase() as 'get';
    return !documento.paths[caminho]?.[metodo];
  });

  if (faltando.length > 0) {
    const lista = faltando.map(([chave, rota]) => `${rota.metodo} ${rota.caminho} (${chave})`);
    new Logger('Swagger').error(`Rotas do contrato que não estão no Swagger:\n  ${lista.join('\n  ')}`);
  }
}
