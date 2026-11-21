// A imagem da capa da turma: o que o PUT /turmas/:id/capa aceita, e como ela
// volta para a tela. Funções soltas, sem Nest: a regra fica testável sozinha.
//
// Quem reduz e converte é o NAVEGADOR (js/utils/imagemDaCapa.ts): no máximo
// 1200×400, em WEBP de até 150 KB. Aqui só se confere, porque um curl pode
// mandar qualquer coisa: o tipo, o tamanho, a assinatura RIFF/WEBP e as
// dimensões lidas do cabeçalho. O back não decodifica a imagem.
import type { BancoService } from '../banco/banco.service.js';
import { dadosInvalidos } from '../dados-invalidos.js';

export const CAPA_LARGURA_MAXIMA = 1200;
export const CAPA_ALTURA_MAXIMA = 400;
export const CAPA_BYTES_MAXIMOS = 150 * 1024;

// A imagem viaja dentro do JSON, como data URL: o api.ts do front só fala
// JSON, e assim a mesma string vira o src do <img> sem passo a mais.
const PREFIXO = 'data:image/webp;base64,';
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// O corpo { imagem } do PUT, já conferido, em bytes para a coluna CapaImagem.
export function bytesDaCapa(valor: unknown): Uint8Array<ArrayBuffer> {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIXO)) {
    throw dadosInvalidos('A capa precisa ser uma imagem WEBP.');
  }
  const base64 = valor.slice(PREFIXO.length);
  // 4 caracteres de base64 viram 3 bytes: o teto antes de decodificar, para
  // não montar um Buffer enorme só para recusar depois.
  if (base64.length > Math.ceil(CAPA_BYTES_MAXIMOS / 3) * 4 || !BASE64.test(base64)) {
    throw dadosInvalidos('A imagem da capa pode ter no máximo 150 KB.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > CAPA_BYTES_MAXIMOS) {
    throw dadosInvalidos('A imagem da capa pode ter no máximo 150 KB.');
  }
  const tamanho = dimensoesDoWebp(bytes);
  if (!tamanho) {
    throw dadosInvalidos('A capa precisa ser uma imagem WEBP.');
  }
  if (tamanho.largura > CAPA_LARGURA_MAXIMA || tamanho.altura > CAPA_ALTURA_MAXIMA) {
    throw dadosInvalidos(`A imagem da capa pode ter no máximo ${CAPA_LARGURA_MAXIMA}×${CAPA_ALTURA_MAXIMA} pixels.`);
  }
  // Cópia em Uint8Array simples: é o tipo que o Prisma pede para Bytes.
  return new Uint8Array(bytes);
}

export function capaComoDataUrl(bytes: Uint8Array): string {
  return PREFIXO + Buffer.from(bytes).toString('base64');
}

// Largura e altura do cabeçalho do WEBP, ou null se não for um. Os três
// formatos do contêiner RIFF/WEBP: VP8 (com perda), VP8L (sem perda) e VP8X
// (estendido, o que o canvas usa com transparência).
export function dimensoesDoWebp(b: Buffer): { largura: number; altura: number } | null {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') {
    return null;
  }
  const bloco = b.toString('latin1', 12, 16);
  if (bloco === 'VP8X') {
    return { largura: 1 + b.readUIntLE(24, 3), altura: 1 + b.readUIntLE(27, 3) };
  }
  if (bloco === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { largura: b.readUInt16LE(26) & 0x3fff, altura: b.readUInt16LE(28) & 0x3fff };
  }
  if (bloco === 'VP8L' && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

// Quais destas turmas têm imagem, sem trazer a imagem: o temCapa de cada
// Turma e Sala. Uma consulta para a lista toda.
export async function turmasComCapa(banco: BancoService, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const linhas = await banco.classesprof.findMany({
    where: { ClassID: { in: ids }, CapaImagem: { not: null } },
    select: { ClassID: true },
  });
  return new Set(linhas.map((linha) => linha.ClassID));
}
