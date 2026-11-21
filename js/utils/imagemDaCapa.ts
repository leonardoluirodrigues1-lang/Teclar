// A imagem que o professor escolhe no computador vira a capa da turma: o
// NAVEGADOR recorta, reduz e converte, e o back só confere (back/src/turmas/
// capa.ts). Sai um WEBP de no máximo 1200×400 e 150 KB, em data URL — a forma
// que o PUT /turmas/:id/capa recebe e que o <img> mostra.

export const CAPA_LARGURA = 1200;
export const CAPA_ALTURA = 400;
export const CAPA_BYTES = 150 * 1024;

// A capa é uma faixa 3:1 (a do cartão e a do topo da turma): o meio da foto
// é recortado nessa proporção, para nada ficar esticado nem com faixa preta.
const PROPORCAO = CAPA_LARGURA / CAPA_ALTURA;

// Qualidades tentadas, da melhor para a menor; se nem a menor cabe em
// 150 KB, a imagem encolhe 25% e tenta de novo.
const QUALIDADES = [0.85, 0.7, 0.55, 0.4];
const LARGURA_MINIMA = 300;

/** O recorte 3:1 do meio da foto e o tamanho final (nunca maior que a foto). */
export function medidasDaCapa(largura: number, altura: number) {
  const recorte =
    largura / altura > PROPORCAO
      ? { largura: Math.round(altura * PROPORCAO), altura }
      : { largura, altura: Math.round(largura / PROPORCAO) };
  const x = Math.round((largura - recorte.largura) / 2);
  const y = Math.round((altura - recorte.altura) / 2);
  const escala = Math.min(1, CAPA_LARGURA / recorte.largura);
  return {
    x,
    y,
    recorte,
    final: {
      largura: Math.max(1, Math.round(recorte.largura * escala)),
      altura: Math.max(1, Math.min(CAPA_ALTURA, Math.round(recorte.altura * escala))),
    },
  };
}

/** O arquivo escolhido, pronto para api.turmas.enviarCapa. Rejeita com uma
 *  mensagem para a tela quando não dá. */
export async function imagemDaCapa(arquivo: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não deu para abrir esse arquivo. Escolha uma imagem JPG, PNG ou WEBP.');
  }
  try {
    const { x, y, recorte, final } = medidasDaCapa(bitmap.width, bitmap.height);
    let { largura, altura } = final;
    const canvas = document.createElement('canvas');
    for (;;) {
      canvas.width = largura;
      canvas.height = altura;
      canvas.getContext('2d').drawImage(bitmap, x, y, recorte.largura, recorte.altura, 0, 0, largura, altura);
      for (const qualidade of QUALIDADES) {
        const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', qualidade));
        // Navegador que não gera WEBP devolve PNG no lugar, sem erro.
        if (!blob || blob.type !== 'image/webp') {
          throw new Error('Este navegador não consegue gerar a imagem. Tente pelo Chrome, Edge ou Firefox.');
        }
        if (blob.size <= CAPA_BYTES) return await comoDataUrl(blob);
      }
      if (largura * 0.75 < LARGURA_MINIMA) {
        throw new Error('Essa imagem não coube em 150 KB. Tente outra, com menos detalhes.');
      }
      largura = Math.round(largura * 0.75);
      altura = Math.round(altura * 0.75);
    }
  } finally {
    bitmap.close();
  }
}

function comoDataUrl(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result as string);
    leitor.onerror = () => falha(new Error('Não deu para ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
}
