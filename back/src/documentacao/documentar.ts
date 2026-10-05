// documentar.ts
// Os decoradores que documentam cada rota no Swagger:
//
//   @Documentar('auth.entrar')               rota pronta
//   @DocumentarNaoImplementada('conta.rp')   rota que ainda responde 501
//
// O texto (resumo, descrição, corpo, exemplos, erros) NÃO é escrito aqui:
// vem de contrato.gerado.ts, que o gerar-contrato.mjs monta a partir do
// mesmo api.ts que gera o CONTRATO-API.md. Mudou o contrato, roda
// "npm run contrato" na raiz e o Swagger acompanha.
//
// A chave é o nome da chamada no front, sem o "api." ('turmas.listar').
// Mais de uma chave numa rota é a mesma rota HTTP servindo a várias
// chamadas: o PATCH /turmas/:id renomeia, troca a capa, arquiva e
// desarquiva. O Swagger mostra uma rota só, com as variantes dentro.
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CONTRATO } from './contrato.gerado.js';
import type { ErroDoContrato, Exemplo, RotaDoContrato } from './contrato.gerado.js';
import { CORPO_DA_ROTA_NAO_IMPLEMENTADA } from './nao-implementada.js';

// As três rotas públicas, como diz a primeira convenção do contrato. Todas
// as outras exigem "Authorization: Bearer <token>" e ganham o cadeado.
const ROTAS_PUBLICAS = ['auth.entrar', 'auth.cadastrar', 'auth.sair'];

// Também da convenção: token ausente, vencido ou inválido em qualquer rota
// protegida. Entra em todas, mesmo nas que não o listam no @erros.
const ERRO_DE_TOKEN: ErroDoContrato = {
  status: 401,
  codigo: 'TOKEN_INVALIDO',
  quando: 'token ausente, vencido ou inválido',
};

export function Documentar(...chaves: string[]): MethodDecorator {
  return documentarRota(chaves, true);
}

export function DocumentarNaoImplementada(...chaves: string[]): MethodDecorator {
  return documentarRota(chaves, false);
}

function documentarRota(chaves: string[], implementada: boolean): MethodDecorator {
  const rotas = buscarRotas(chaves);
  const primeira = rotas[0];
  const publica = chaves.every((chave) => ROTAS_PUBLICAS.includes(chave));

  const decoradores = [
    ApiTags(primeira.grupo),
    ApiOperation({
      operationId: chaves.join('_'),
      summary: resumo(chaves, rotas, implementada),
      description: descricao(chaves, rotas, implementada),
    }),
    ...parametrosDoCaminho(primeira),
    ...parametrosDaQuery(rotas),
    ...corpo(chaves, rotas),
    respostaDeSucesso(chaves, rotas),
    ...respostasDeErro(rotas, publica),
  ];
  if (!publica) {
    decoradores.push(ApiBearerAuth());
  }
  if (!implementada) {
    decoradores.push(respostaNaoImplementada());
  }
  return applyDecorators(...decoradores);
}

// Confere as chaves na subida: um nome digitado errado num controller
// derruba o back na hora, em vez de sumir em silêncio do Swagger.
function buscarRotas(chaves: string[]): RotaDoContrato[] {
  const rotas = chaves.map((chave) => {
    const rota = CONTRATO[chave];
    if (!rota) {
      throw new Error(`@Documentar: "${chave}" não existe no contrato (contrato.gerado.ts).`);
    }
    return rota;
  });
  const endereco = (r: RotaDoContrato) => `${r.metodo} ${r.caminho}`;
  if (rotas.some((r) => endereco(r) !== endereco(rotas[0]))) {
    throw new Error(`@Documentar: ${chaves.join(', ')} não são a mesma rota HTTP.`);
  }
  return rotas;
}

// ============================================================================
// Resumo e descrição
// ============================================================================

// "turmas.renomear" -> "renomear": o nome da chamada é o verbo da rota.
function nomeCurto(chave: string): string {
  return chave.split('.').pop() ?? chave;
}

// O contrato não tem um campo "resumo"; o mais próximo, sem inventar texto,
// é o nome da chamada e o que a rota devolve.
function resumo(chaves: string[], rotas: RotaDoContrato[], implementada: boolean): string {
  const texto =
    rotas.length === 1
      ? `${nomeCurto(chaves[0])}: ${rotas[0].resposta.descricao}`
      : chaves.map(nomeCurto).join(' / ');
  return implementada ? texto : `(ainda não implementada) ${texto}`;
}

function descricao(chaves: string[], rotas: RotaDoContrato[], implementada: boolean): string {
  const partes: string[] = [];
  if (!implementada) {
    partes.push('**Ainda não implementada:** hoje responde 501. O que está abaixo é o contrato que ela vai cumprir.');
  }
  rotas.forEach((rota, i) => {
    if (rotas.length > 1) {
      partes.push(`### ${nomeCurto(chaves[i])}`);
    }
    partes.push(...secoesDaRota(rota));
  });
  return partes.join('\n\n');
}

// As mesmas seções do CONTRATO-API.md, com os mesmos títulos.
function secoesDaRota(rota: RotaDoContrato): string[] {
  const secoes = [`**Chamada no front:** \`${rota.chamada}\``];
  if (rota.corpo) secoes.push(`**Corpo:** ${rota.corpo.descricao}`);
  secoes.push(`**Resposta:** ${rota.resposta.status} ${rota.resposta.descricao}`);
  if (rota.identidade) secoes.push(`**Identidade:**\n\n${rota.identidade}`);
  if (rota.regras) secoes.push(`**Regras de negócio no back (a tela não calcula):**\n\n${rota.regras}`);
  if (rota.notas) secoes.push(`**Notas:**\n\n${rota.notas}`);
  return secoes;
}

// ============================================================================
// Parâmetros: caminho (:id) e query (?ativa=)
// ============================================================================

// Cada ":nome" do caminho vira um parâmetro obrigatório, para o "Try it
// out" do Swagger ter onde digitar o valor.
function parametrosDoCaminho(rota: RotaDoContrato): MethodDecorator[] {
  const nomes = rota.caminho
    .split('/')
    .filter((trecho) => trecho.startsWith(':'))
    .map((trecho) => trecho.slice(1));
  return nomes.map((nome) => ApiParam({ name: nome, required: true, type: String }));
}

// A query é sempre opcional: GET /turmas responde sem ela, e com
// ?ativa=false lista as arquivadas.
function parametrosDaQuery(rotas: RotaDoContrato[]): MethodDecorator[] {
  const nomes = [...new Set(rotas.flatMap((rota) => rota.query))];
  return nomes.map((nome) => ApiQuery({ name: nome, required: false, type: String }));
}

// ============================================================================
// Corpo e respostas
// ============================================================================

// Exemplos no formato do OpenAPI: { chave: { summary, value } }. O rótulo
// é o do contrato ("Aluno") ou, com várias variantes, o nome delas.
function exemplosDoSwagger(itens: { rotulo: string; exemplo: Exemplo }[]) {
  const exemplos: Record<string, { summary: string; value: unknown }> = {};
  itens.forEach(({ rotulo, exemplo }, i) => {
    exemplos[`exemplo${i + 1}`] = { summary: rotulo || `Exemplo ${i + 1}`, value: exemplo.valor };
  });
  return exemplos;
}

// Junta os exemplos de todas as variantes, cada um com o seu rótulo.
function exemplosDasVariantes(chaves: string[], listas: Exemplo[][]) {
  return listas.flatMap((exemplos, i) =>
    exemplos.map((exemplo) => ({
      rotulo: [chaves.length > 1 ? nomeCurto(chaves[i]) : '', exemplo.rotulo].filter(Boolean).join(' — '),
      exemplo,
    })),
  );
}

function corpo(chaves: string[], rotas: RotaDoContrato[]): MethodDecorator[] {
  const comCorpo = rotas.filter((rota) => rota.corpo);
  if (comCorpo.length === 0) {
    return [];
  }
  const listas = rotas.map((rota) => rota.corpo?.exemplos ?? []);
  return [
    ApiBody({
      description: comCorpo.map((rota) => rota.corpo?.descricao).join(' | '),
      schema: { type: 'object' },
      examples: exemplosDoSwagger(exemplosDasVariantes(chaves, listas)),
    }),
  ];
}

function respostaDeSucesso(chaves: string[], rotas: RotaDoContrato[]): MethodDecorator {
  const { status } = rotas[0].resposta;
  const descricoes = [...new Set(rotas.map((rota) => rota.resposta.descricao))].join(' | ');
  const itens = exemplosDasVariantes(
    chaves,
    rotas.map((rota) => rota.resposta.exemplos),
  );
  if (itens.length === 0) {
    return ApiResponse({ status, description: descricoes });
  }
  return ApiResponse({ status, description: descricoes, examples: exemplosDoSwagger(itens) });
}

// Um ApiResponse por status (o Swagger não aceita dois 404 na mesma rota):
// os erros de mesmo status viram exemplos do mesmo bloco. O corpo de erro
// é o da convenção: { mensagem, codigo }. A mensagem não está no contrato
// (a tela não decide por ela), por isso o exemplo mostra "...".
function respostasDeErro(rotas: RotaDoContrato[], publica: boolean): MethodDecorator[] {
  const erros = rotas.flatMap((rota) => rota.erros);
  if (!publica && !erros.some((erro) => erro.codigo === 'TOKEN_INVALIDO')) {
    erros.push(ERRO_DE_TOKEN);
  }

  const porStatus = new Map<number, ErroDoContrato[]>();
  for (const erro of erros) {
    const lista = porStatus.get(erro.status) ?? [];
    // Variantes do PATCH repetem o mesmo erro: entra uma vez só.
    if (!lista.some((e) => e.codigo === erro.codigo && e.quando === erro.quando)) {
      lista.push(erro);
    }
    porStatus.set(erro.status, lista);
  }

  return [...porStatus.entries()].map(([status, lista]) =>
    ApiResponse({
      status,
      description: lista.map(descreverErro).join('\n\n'),
      examples: exemplosDoSwagger(
        lista.map((erro) => ({
          rotulo: erro.codigo ?? 'sem código',
          exemplo: { rotulo: '', valor: { mensagem: '...', codigo: erro.codigo } },
        })),
      ),
    }),
  );
}

// "NAO_ENCONTRADO — não existe ou é de outra conta"
function descreverErro(erro: ErroDoContrato): string {
  const codigo = erro.codigo ? `\`${erro.codigo}\`` : '(sem código)';
  return erro.quando ? `${codigo} — ${erro.quando}` : codigo;
}

function respostaNaoImplementada(): MethodDecorator {
  return ApiResponse({
    status: 501,
    description: 'A rota existe no contrato, mas ainda não foi implementada no back.',
    example: CORPO_DA_ROTA_NAO_IMPLEMENTADA,
  });
}
