// A imagem WEBP que viaja dentro do JSON como data URL (capa da turma, foto
// de perfil): o que o back aceita e como ela volta. Funções soltas, sem Nest.
//
// Quem reduz e converte é o NAVEGADOR (js/utils/imagemDaCapa.ts). Aqui só se
// confere, porque um curl pode mandar qualquer coisa: o tipo, o tamanho, a
// assinatura RIFF/WEBP e as dimensões lidas do cabeçalho. O back não
// decodifica a imagem.
import { dadosInvalidos } from './dados-invalidos.js';

// A imagem viaja dentro do JSON, como data URL: o api.ts do front só fala
// JSON, e assim a mesma string vira o src do <img> sem passo a mais.
const PREFIXO = 'data:image/webp;base64,';
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface LimitesDaImagem {
  bytes: number;
  largura: number;
  altura: number;
  /** Largura igual à altura (a foto de perfil). */
  quadrada?: boolean;
  /** Para as mensagens: "A capa" / "A foto". */
  oQue: string;
  /** "A imagem da capa" / "A foto". */
  aImagem: string;
}

// O { imagem } do corpo, já conferido, em bytes para a coluna MEDIUMBLOB.
export function bytesDoWebp(valor: unknown, limites: LimitesDaImagem): Uint8Array<ArrayBuffer> {
  const naoEWebp = () => dadosInvalidos(`${limites.oQue} precisa ser uma imagem WEBP.`);
  const grandeDemais = () => dadosInvalidos(`${limites.aImagem} pode ter no máximo ${limites.bytes / 1024} KB.`);
  if (typeof valor !== 'string' || !valor.startsWith(PREFIXO)) {
    throw naoEWebp();
  }
  const base64 = valor.slice(PREFIXO.length);
  // 4 caracteres de base64 viram 3 bytes: o teto antes de decodificar, para
  // não montar um Buffer enorme só para recusar depois.
  if (base64.length > Math.ceil(limites.bytes / 3) * 4 || !BASE64.test(base64)) {
    throw grandeDemais();
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > limites.bytes) {
    throw grandeDemais();
  }
  const tamanho = dimensoesDoWebp(bytes);
  if (!tamanho) {
    throw naoEWebp();
  }
  if (tamanho.largura > limites.largura || tamanho.altura > limites.altura) {
    throw dadosInvalidos(`${limites.aImagem} pode ter no máximo ${limites.largura}×${limites.altura} pixels.`);
  }
  if (limites.quadrada && tamanho.largura !== tamanho.altura) {
    throw dadosInvalidos(`${limites.oQue} precisa ser quadrada.`);
  }
  // Cópia em Uint8Array simples: é o tipo que o Prisma pede para Bytes.
  return new Uint8Array(bytes);
}

export function webpComoDataUrl(bytes: Uint8Array): string {
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
