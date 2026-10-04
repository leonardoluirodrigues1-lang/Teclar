// gerar-contrato.mjs
// Gera o CONTRATO-API.md (na raiz) a partir dos comentários de
// js/nucleo/api.ts. Rodar com:  node gerar-contrato.mjs
//
// Por que gerar, e não escrever o .md à mão: o api.ts é o contrato que o
// front de fato chama. Um .md escrito à parte começaria a divergir dele na
// primeira rota alterada; gerado, ele é sempre o que o api.ts diz. Se os
// dois discordarem, vale o api.ts — basta rodar este script de novo.
//
// O que ele lê (o formato está explicado no topo da seção 5 do api.ts):
//   · no cabeçalho do arquivo, as marcas @convencao, @coluna-pendente
//     (coluna que ainda não existe), @coluna-redefinida (coluna que existe e
//     muda de significado) e @pendencia (decisão de banco ainda em aberto);
//   · dentro do objeto `api`, as marcas @grupo e, por rota, @rota, @corpo,
//     @resposta, @erros, @identidade, @back e @nota.
// Uma marca começa em "// @nome" e continua nas linhas de comentário
// seguintes que começam com espaço ("//   ..."). Linha de comentário sem
// recuo, dentro de uma rota, também continua a marca atual.
//
// Sem dependência nenhuma: só o Node.

import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEM = 'js/nucleo/api.ts';
const DESTINO = 'CONTRATO-API.md';

// Colunas de nome comum demais para valer sozinho na busca de "usada em":
// "Status" e "Ativa" aparecem em todo canto. Para elas, a tabela tem de
// estar por perto no texto (ex.: "ClassMembers com Status").
const COLUNAS_DE_NOME_COMUM = ['Status', 'Ativa'];

// ============================================================================
// Leitura do api.ts
// ============================================================================

// Uma linha do arquivo vira { tipo, ... }: marca, comentário ou código.
function classificar(linha) {
  const marca = /^\s*\/\/ @([a-z-]+)\s?(.*)$/.exec(linha);
  if (marca) return { tipo: 'marca', nome: marca[1], texto: marca[2] };
  const comentario = /^\s*\/\/ ?(.*)$/.exec(linha);
  if (comentario) return { tipo: 'comentario', texto: comentario[1] };
  return { tipo: 'codigo', texto: linha };
}

function lerContrato(fonte) {
  const contrato = { convencoes: [], colunas: [], redefinidas: [], pendencias: [], grupos: [] };
  // Cada marca do cabeçalho vai para a sua lista.
  const listaDoCabecalho = {
    convencao: contrato.convencoes,
    'coluna-pendente': contrato.colunas,
    'coluna-redefinida': contrato.redefinidas,
    pendencia: contrato.pendencias,
  };
  // O que está sendo montado agora: uma marca do cabeçalho, uma introdução
  // de grupo ou uma rota. Só um por vez.
  let marcaDoCabecalho = null;
  let grupo = null;
  let lendoIntro = false;
  let rota = null;
  let marcaDaRota = null;
  // As chaves dos objetos abertos, para montar "api.escola.aluno.salas".
  const caminho = [];

  for (const bruta of fonte.split(/\r?\n/)) {
    const linha = classificar(bruta);

    if (linha.tipo === 'marca') {
      marcaDoCabecalho = null;
      if (listaDoCabecalho[linha.nome]) {
        marcaDoCabecalho = { texto: [linha.texto] };
        listaDoCabecalho[linha.nome].push(marcaDoCabecalho);
      } else if (linha.nome === 'grupo') {
        grupo = { nome: linha.texto, intro: [], rotas: [] };
        contrato.grupos.push(grupo);
        lendoIntro = true;
      } else if (linha.nome === 'rota') {
        rota = { rota: linha.texto, marcas: {}, funcao: null };
        grupo.rotas.push(rota);
        lendoIntro = false;
        marcaDaRota = null;
      } else if (rota) {
        marcaDaRota = linha.nome;
        rota.marcas[marcaDaRota] = [linha.texto];
      }
      continue;
    }

    if (linha.tipo === 'comentario') {
      const recuada = /^\s/.test(linha.texto);
      if (marcaDoCabecalho && recuada) {
        marcaDoCabecalho.texto.push(linha.texto);
      } else if (rota && marcaDaRota) {
        rota.marcas[marcaDaRota].push(linha.texto);
      } else if (lendoIntro && grupo) {
        grupo.intro.push(linha.texto);
      }
      if (!recuada) marcaDoCabecalho = null;
      continue;
    }

    // Código: fecha a rota (a primeira linha de código depois dela é o
    // método do objeto api) e acompanha a abertura e o fechamento de objetos.
    marcaDoCabecalho = null;
    lendoIntro = false;
    const chave = /^\s*(\w+):/.exec(linha.texto);
    if (rota && chave) {
      rota.funcao = ['api', ...caminho, chave[1]].join('.');
      rota = null;
      marcaDaRota = null;
    }
    const abre = /^\s*(\w+): \{\s*$/.exec(linha.texto);
    if (abre) caminho.push(abre[1]);
    else if (/^\s*\},?\s*$/.test(linha.texto)) caminho.pop();
  }

  return contrato;
}

// ============================================================================
// Escrita do .md
// ============================================================================

// Junta as linhas de uma marca em parágrafo. Linha com recuo de 4 ou mais
// é bloco (uma fórmula, uma lista alinhada) e vai num bloco de código.
function paragrafo(linhas) {
  const partes = [];
  let bloco = [];
  let texto = [];
  const fecharTexto = () => {
    if (texto.length) partes.push(texto.join(' '));
    texto = [];
  };
  const fecharBloco = () => {
    if (bloco.length) partes.push('```\n' + bloco.join('\n') + '\n```');
    bloco = [];
  };
  for (const linha of linhas) {
    if (/^\s{4,}/.test(linha)) {
      fecharTexto();
      bloco.push(linha.replace(/^\s{4}/, ''));
    } else {
      fecharBloco();
      texto.push(linha.trim());
    }
  }
  fecharTexto();
  fecharBloco();
  return partes.join('\n\n');
}

// @corpo e @resposta: a 1ª linha é a descrição; o resto, o exemplo.
function descricaoComExemplo(linhas) {
  const [descricao, ...exemplo] = linhas;
  const corpo = exemplo.map((l) => l.replace(/^\s{2}/, '')).join('\n').trim();
  return corpo ? `${descricao}\n\n\`\`\`json\n${corpo}\n\`\`\`` : descricao;
}

// @erros: um erro por linha.
function lista(linhas) {
  return linhas.map((l) => `- ${l.trim()}`).join('\n');
}

function textoDaRota(rota) {
  return Object.values(rota.marcas).flat().join(' ');
}

// "Usada em": as rotas cujo texto cita a coluna — pelo nome completo
// ("Turmas.Ativa") ou só pelo da coluna. Para nome comum demais
// ("Status"), sozinho não vale: a tabela tem de aparecer até 40
// caracteres antes ("ClassMembers com Status").
function rotasQueUsam(coluna, grupos) {
  const [tabela, nome] = coluna.split('.');
  const procura = COLUNAS_DE_NOME_COMUM.includes(nome)
    ? new RegExp(`${tabela}.{0,40}\\b${nome}\\b`)
    : new RegExp(`\\b${nome}\\b`);
  const usadas = [];
  for (const grupo of grupos) {
    for (const rota of grupo.rotas) {
      if (procura.test(textoDaRota(rota))) usadas.push(`\`${rota.rota}\``);
    }
  }
  return [...new Set(usadas)];
}

// "Turmas.Ativa — BOOLEAN..." vira { nome: 'Turmas.Ativa', descricao: 'BOOLEAN...' }.
function nomeEDescricao(item) {
  const [primeira, ...resto] = item.texto;
  const nome = primeira.split(' — ')[0].trim();
  const descricao = [primeira.slice(primeira.indexOf('—') + 1).trim(), ...resto.map((l) => l.trim())].join(' ');
  return { nome, descricao };
}

// Uma lista de colunas, cada uma com as rotas que a citam. A caixa [ ] é
// para o Cauê marcar o que já migrou.
function escreverListaDeColunas(titulo, intro, itens, grupos) {
  const linhas = [`## ${titulo}`, '', intro, ''];
  for (const item of itens) {
    const { nome, descricao } = nomeEDescricao(item);
    const usadas = rotasQueUsam(nome, grupos);
    linhas.push(`- [ ] **${nome}** — ${descricao}`);
    if (usadas.length) linhas.push(`  Usada em: ${usadas.join(', ')}.`);
  }
  return linhas.join('\n');
}

function escreverColunas(contrato) {
  return escreverListaDeColunas(
    'Colunas que ainda não existem no banco',
    'O contrato abaixo já usa estas colunas. Até a migração, só o mock responde como se elas existissem.',
    contrato.colunas,
    contrato.grupos,
  );
}

// Separada da lista acima de propósito: estas colunas NÃO precisam ser
// criadas, e quem migra o banco não pode confundir as duas coisas.
function escreverRedefinidas(contrato) {
  return escreverListaDeColunas(
    'Colunas que já existem e mudam de significado',
    'Não é para criar: a coluna existe. O que muda na v6 é o que ela guarda.',
    contrato.redefinidas,
    contrato.grupos,
  );
}

function escreverPendencias(contrato) {
  const linhas = ['## Decisões de banco em aberto', ''];
  for (const item of contrato.pendencias) {
    const { nome, descricao } = nomeEDescricao(item);
    linhas.push(`- **${nome}** — ${descricao}`);
  }
  return linhas.join('\n');
}

function escreverConvencoes(contrato) {
  const linhas = ['## Convenções de todas as rotas', ''];
  for (const convencao of contrato.convencoes) {
    linhas.push(`- ${convencao.texto.map((l) => l.trim()).join(' ')}`);
  }
  return linhas.join('\n');
}

// A ordem das marcas no .md é sempre a mesma, venha o comentário na ordem
// que vier.
const SECOES_DA_ROTA = [
  ['corpo', 'Corpo', descricaoComExemplo],
  ['resposta', 'Resposta', descricaoComExemplo],
  ['erros', 'Erros', lista],
  ['identidade', 'Identidade', paragrafo],
  ['back', 'Regras de negócio no back (a tela não calcula)', paragrafo],
  ['nota', 'Notas', paragrafo],
];

// O mesmo MÉTODO /caminho pode servir a mais de uma chamada (o PATCH
// /turmas/:id renomeia, troca a capa, arquiva e desarquiva). Nesse caso o
// nome da chamada vai junto, para o índice e os títulos não se repetirem.
function rotulo(rota, grupo) {
  const repetida = grupo.rotas.filter((r) => r.rota === rota.rota).length > 1;
  const caminho = `\`${rota.rota}\``;
  return repetida ? `${caminho} (${rota.funcao.split('.').pop()})` : caminho;
}

function escreverRota(rota, grupo) {
  const linhas = [`### ${rotulo(rota, grupo)}`, '', `Chamada no front: \`${rota.funcao}\``, ''];
  if (!rota.marcas.corpo) linhas.push('**Corpo:** nenhum.', '');
  for (const [marca, titulo, formatar] of SECOES_DA_ROTA) {
    if (!rota.marcas[marca]) continue;
    linhas.push(`**${titulo}:**`, '', formatar(rota.marcas[marca]), '');
  }
  return linhas.join('\n');
}

function escreverGrupo(grupo) {
  const linhas = [`## ${grupo.nome}`, ''];
  if (grupo.intro.length) linhas.push(paragrafo(grupo.intro), '');
  for (const rota of grupo.rotas) linhas.push(escreverRota(rota, grupo));
  return linhas.join('\n');
}

function escreverIndice(contrato) {
  const linhas = ['## Índice', ''];
  for (const grupo of contrato.grupos) {
    linhas.push(`- **${grupo.nome}**: ${grupo.rotas.map((r) => rotulo(r, grupo)).join(', ')}`);
  }
  return linhas.join('\n');
}

function escreverMarkdown(contrato) {
  const total = contrato.grupos.reduce((soma, g) => soma + g.rotas.length, 0);
  return [
    '# Contrato da API — TECLAR',
    '',
    `> Gerado de \`${ORIGEM}\` por \`gerar-contrato.mjs\`. **Não edite este arquivo:**`,
    '> mude o comentário da rota no api.ts e rode `node gerar-contrato.mjs` de novo.',
    '> Se este arquivo e o api.ts divergirem, vale o api.ts.',
    '',
    `${total} chamadas em ${contrato.grupos.length} grupos. Os tipos citados (Turma, Sessao...) estão em \`js/nucleo/tipos.ts\`.`,
    '',
    escreverColunas(contrato),
    '',
    escreverRedefinidas(contrato),
    '',
    escreverPendencias(contrato),
    '',
    escreverConvencoes(contrato),
    '',
    escreverIndice(contrato),
    '',
    ...contrato.grupos.map(escreverGrupo),
  ].join('\n');
}

// ============================================================================
// Execução
// ============================================================================

const contrato = lerContrato(readFileSync(ORIGEM, 'utf8'));

// Uma rota sem método no api.ts é sinal de comentário fora do lugar:
// melhor parar do que gerar um contrato com buraco.
const semFuncao = contrato.grupos.flatMap((g) => g.rotas).filter((r) => !r.funcao);
if (semFuncao.length) {
  console.error('Rotas sem método logo abaixo do comentário:', semFuncao.map((r) => r.rota));
  process.exit(1);
}

writeFileSync(DESTINO, escreverMarkdown(contrato) + '\n', 'utf8');
console.log(`${DESTINO}: ${contrato.grupos.length} grupos, ${contrato.grupos.flatMap((g) => g.rotas).length} rotas.`);
