// A imagem da capa da turma: o que o PUT /turmas/:id/capa aceita, e como ela
// volta para a tela. A conferência do WEBP é a de ../imagem-webp.ts (a mesma
// da foto de perfil); aqui ficam os limites da capa: no máximo 1200×400, em
// WEBP de até 150 KB, reduzida e convertida pelo navegador.
import type { BancoService } from '../banco/banco.service.js';
import { bytesDoWebp, webpComoDataUrl } from '../imagem-webp.js';

export const CAPA_LARGURA_MAXIMA = 1200;
export const CAPA_ALTURA_MAXIMA = 400;
export const CAPA_BYTES_MAXIMOS = 150 * 1024;

// O corpo { imagem } do PUT, já conferido, em bytes para a coluna CapaImagem.
export function bytesDaCapa(valor: unknown): Uint8Array<ArrayBuffer> {
  return bytesDoWebp(valor, {
    bytes: CAPA_BYTES_MAXIMOS,
    largura: CAPA_LARGURA_MAXIMA,
    altura: CAPA_ALTURA_MAXIMA,
    oQue: 'A capa',
    aImagem: 'A imagem da capa',
  });
}

export const capaComoDataUrl = webpComoDataUrl;

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
