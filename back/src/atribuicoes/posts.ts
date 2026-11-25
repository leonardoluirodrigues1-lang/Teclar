// O post da atividade (a página de tarefa, no estilo do Moodle): título,
// instruções em Markdown, até 5 links e até 3 anexos, mais as datas "Aberto
// em" (antes dela o aluno não vê a atividade) e "Vencimento" (AtribuicoesProf.Prazo).
// Funções soltas, com o banco por parâmetro: o professor (PostsService) e o
// aluno (AlunoService) leem o mesmo post do mesmo jeito.
//
// O conteúdo dos anexos (MEDIUMBLOB) só é lido no download: toda outra
// consulta usa SEM_CONTEUDO.
import { Prisma } from '../generated/prisma/client.js';
import type { BancoService } from '../banco/banco.service.js';
import { dadosInvalidos } from '../dados-invalidos.js';
import { temCaractereDeControle } from '../texto-limpo.js';

export const LINKS_MAXIMO = 5;
export const ANEXOS_MAXIMO = 3;
export const ANEXO_BYTES_MAXIMOS = 2 * 1024 * 1024;
export const INSTRUCOES_MAXIMO = 10_000;
const TITULO_MAXIMO = 150;
const URL_MAXIMO = 2000;
const NOME_MAXIMO = 255;

export interface LinkDoPost {
  titulo: string;
  url: string;
}

export interface AnexoDoPost {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  enviadoEm: string | null;
}

// GET/PUT do professor. Sem post (existe: false), os padrões: o título do
// exercício e "Aberto em" = a data da atribuição.
export interface PostDaAtividade {
  existe: boolean;
  titulo: string;
  instrucoes: string;
  links: LinkDoPost[];
  anexos: AnexoDoPost[];
  abertoEm: string | null;
  prazo: string | null;
  atualizadoEm: string | null;
}

export interface ArquivoDoAnexo {
  nome: string;
  tipo: string;
  // base64, como a capa da turma: a tela monta o arquivo e baixa.
  conteudo: string;
}

export interface CorpoDoPost {
  titulo?: unknown;
  instrucoes?: unknown;
  links?: unknown;
  abertoEm?: unknown;
  prazo?: unknown;
  professorId?: unknown;
}

export interface CorpoDoAnexo {
  nome?: unknown;
  conteudo?: unknown;
  professorId?: unknown;
}

export const SEM_CONTEUDO = { ID: true, NomeArquivo: true, Tipo: true, Tamanho: true, DataEnvio: true } as const;

const COM_POST = {
  exerciciosprof: { select: { Titulo: true } },
  atribuicoesposts: {
    include: {
      atribuicoeslinks: { orderBy: { Ordem: 'asc' } },
      atribuicoesanexos: { select: SEM_CONTEUDO, orderBy: [{ DataEnvio: 'asc' }, { ID: 'asc' }] },
    },
  },
} satisfies Prisma.atribuicoesprofInclude;

export type AtribuicaoComPost = Prisma.atribuicoesprofGetPayload<{ include: typeof COM_POST }>;

// A atribuição com o post (sem o conteúdo dos anexos), ou null.
export function atribuicaoComPost(banco: BancoService, turmaId: string, exercicioId: string): Promise<AtribuicaoComPost | null> {
  return banco.atribuicoesprof.findUnique({
    where: { ClassID_ExerciseID: { ClassID: turmaId, ExerciseID: exercicioId } },
    include: COM_POST,
  });
}

export function postNaForma(linha: AtribuicaoComPost): PostDaAtividade {
  const post = linha.atribuicoesposts;
  return {
    existe: post !== null,
    titulo: post?.Titulo ?? linha.exerciciosprof.Titulo,
    instrucoes: post?.Instrucoes ?? '',
    links: (post?.atribuicoeslinks ?? []).map((l) => ({ titulo: l.Titulo, url: l.URL })),
    anexos: (post?.atribuicoesanexos ?? []).map(anexoNaForma),
    abertoEm: abertoEm(linha)?.toISOString() ?? null,
    prazo: linha.Prazo?.toISOString() ?? null,
    atualizadoEm: post?.DataAtualizacao?.toISOString() ?? null,
  };
}

export function anexoNaForma(a: { ID: string; NomeArquivo: string; Tipo: string; Tamanho: number; DataEnvio: Date | null }): AnexoDoPost {
  return { id: a.ID, nome: a.NomeArquivo, tipo: a.Tipo, tamanho: a.Tamanho, enviadoEm: a.DataEnvio?.toISOString() ?? null };
}

// --- Datas -------------------------------------------------------------------

// Quando a atividade abre para o aluno: o agendado no post, ou a atribuição.
export function abertoEm(linha: { Data_Atribuicao: Date | null; atribuicoesposts?: { AbertoEm: Date | null } | null }): Date | null {
  return linha.atribuicoesposts?.AbertoEm ?? linha.Data_Atribuicao;
}

// O filtro do aluno: sem post, ou sem agendamento, ou já aberta.
export function abertaParaAluno(agora = new Date()): Prisma.atribuicoesprofWhereInput {
  return {
    OR: [
      { atribuicoesposts: { is: null } },
      { atribuicoesposts: { is: { OR: [{ AbertoEm: null }, { AbertoEm: { lte: agora } }] } } },
    ],
  };
}

// Feita depois do vencimento: ainda vale (é treino), mas o professor vê o atraso.
export function feitaComAtraso(dataDaSessao: Date | string | null, prazo: Date | null): boolean {
  return prazo !== null && dataDaSessao !== null && new Date(dataDaSessao).getTime() > prazo.getTime();
}

// --- Validação do PUT ----------------------------------------------------------

export interface PostValidado {
  titulo: string;
  instrucoes: string | null;
  links: LinkDoPost[];
  abertoEm: Date | null;
  prazo: Date | null;
}

export function validarPost(corpo: CorpoDoPost | undefined, tituloDoExercicio: string, dataDaAtribuicao: Date | null): PostValidado {
  const titulo = tituloDoPost(corpo?.titulo, tituloDoExercicio);
  const instrucoes = instrucoesDoPost(corpo?.instrucoes);
  const links = linksDoPost(corpo?.links);
  const aberto = dataOuNull(corpo?.abertoEm, 'abertoEm');
  const prazo = dataOuNull(corpo?.prazo, 'prazo');
  const abreDeFato = aberto ?? dataDaAtribuicao;
  if (prazo && abreDeFato && prazo.getTime() <= abreDeFato.getTime()) {
    throw dadosInvalidos('O vencimento precisa ser depois de "Aberto em".');
  }
  return { titulo, instrucoes, links, abertoEm: aberto, prazo };
}

function tituloDoPost(valor: unknown, padrao: string): string {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    return padrao.slice(0, TITULO_MAXIMO);
  }
  if (typeof valor !== 'string') {
    throw dadosInvalidos('O título precisa ser um texto.');
  }
  const titulo = valor.replace(/\s+/g, ' ').trim();
  if (titulo.length > TITULO_MAXIMO || temCaractereDeControle(titulo)) {
    throw dadosInvalidos(`O título vai de 1 a ${TITULO_MAXIMO} caracteres, sem caractere de controle.`);
  }
  return titulo;
}

// Markdown cru. Quebra de linha e tab valem; outro controle, não. O HTML que
// vier aqui é só texto: a tela escapa tudo ao mostrar (js/utils/markdown.ts).
function instrucoesDoPost(valor: unknown): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor !== 'string') {
    throw dadosInvalidos('As instruções precisam ser um texto.');
  }
  const texto = valor.replace(/\r\n?/g, '\n').trim();
  if (texto.length > INSTRUCOES_MAXIMO || temCaractereDeControle(texto.replace(/[\n\t]/g, ' '))) {
    throw dadosInvalidos(`As instruções vão até ${INSTRUCOES_MAXIMO} caracteres, sem caractere de controle.`);
  }
  return texto === '' ? null : texto;
}

export function urlSegura(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > URL_MAXIMO) {
    return null;
  }
  try {
    const url = new URL(valor.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function linksDoPost(valor: unknown): LinkDoPost[] {
  if (valor === undefined || valor === null) {
    return [];
  }
  if (!Array.isArray(valor) || valor.length > LINKS_MAXIMO) {
    throw dadosInvalidos(`links é uma lista de até ${LINKS_MAXIMO} { titulo, url }.`);
  }
  return valor.map((item: { titulo?: unknown; url?: unknown } | null) => {
    const url = urlSegura(item?.url);
    if (!url) {
      throw dadosInvalidos('Cada link precisa de uma URL http:// ou https://.');
    }
    const bruto = typeof item?.titulo === 'string' ? item.titulo.replace(/\s+/g, ' ').trim() : '';
    if (item?.titulo !== undefined && typeof item.titulo !== 'string') {
      throw dadosInvalidos('O título do link precisa ser um texto.');
    }
    const titulo = (bruto || url).slice(0, TITULO_MAXIMO);
    if (temCaractereDeControle(titulo)) {
      throw dadosInvalidos('O título do link tem caractere de controle.');
    }
    return { titulo, url };
  });
}

function dataOuNull(valor: unknown, campo: string): Date | null {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  const data = typeof valor === 'string' ? new Date(valor) : null;
  if (!data || Number.isNaN(data.getTime())) {
    throw dadosInvalidos(`${campo} precisa ser uma data ISO (ex.: 2026-11-30T23:59:00.000Z) ou null.`);
  }
  return data;
}

// --- Anexos -----------------------------------------------------------------

// O tipo sai do CONTEÚDO (os primeiros bytes), nunca do nome nem do que a
// tela diz: um .exe renomeado para .pdf é recusado.
export function tipoPeloConteudo(b: Buffer): string | null {
  const ascii = (inicio: number, fim: number) => b.subarray(inicio, fim).toString('latin1');
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  // DOCX é um ZIP com as entradas do Word; os nomes das entradas ficam em texto
  // no próprio ZIP. Um ZIP qualquer (ou um .xlsx) não tem word/document.xml.
  if (ascii(0, 4) === 'PK\u0003\u0004' && b.includes('[Content_Types].xml') && b.includes('word/document.xml')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}

export interface AnexoValidado {
  nome: string;
  tipo: string;
  bytes: Buffer;
}

export function validarAnexo(corpo: CorpoDoAnexo | undefined): AnexoValidado {
  const nome = nomeDoArquivo(corpo?.nome);
  if (typeof corpo?.conteudo !== 'string' || corpo.conteudo === '') {
    throw dadosInvalidos('Mande conteudo: o arquivo em base64.');
  }
  const base64 = corpo.conteudo.replace(/^data:[^,]*;base64,/, '');
  // Teto antes de decodificar: base64 tem 4 caracteres a cada 3 bytes.
  if (base64.length > Math.ceil(ANEXO_BYTES_MAXIMOS / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw dadosInvalidos('O arquivo vai até 2 MB, em base64.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > ANEXO_BYTES_MAXIMOS) {
    throw dadosInvalidos('O arquivo vai até 2 MB, em base64.');
  }
  const tipo = tipoPeloConteudo(bytes);
  if (!tipo) {
    throw dadosInvalidos('Só PDF, PNG, JPG, WEBP e DOCX.');
  }
  return { nome, tipo, bytes };
}

// Só o nome, sem pasta; sem controle; até 255.
function nomeDoArquivo(valor: unknown): string {
  const nome = typeof valor === 'string' ? (valor.split(/[\\/]/).pop() ?? '').trim() : '';
  if (nome === '' || nome.length > NOME_MAXIMO || temCaractereDeControle(nome)) {
    throw dadosInvalidos(`Mande nome: o nome do arquivo, de 1 a ${NOME_MAXIMO} caracteres.`);
  }
  return nome;
}
