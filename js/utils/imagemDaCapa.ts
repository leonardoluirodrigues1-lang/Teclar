// A imagem que a pessoa escolhe no computador vira a capa da turma ou a foto
// de perfil: o NAVEGADOR recorta, reduz e converte, e o back só confere
// (back/src/imagem-webp.ts). Sai um WEBP em data URL — a forma que o PUT
// recebe e que o <img> mostra:
//   · capa: faixa 3:1, no máximo 1200×400 e 150 KB (PUT /turmas/:id/capa);
//   · foto: quadrado do meio, no máximo 256×256 e 50 KB (PUT /conta/foto e
//     /aluno/foto).

export const CAPA_LARGURA = 1200;
export const CAPA_ALTURA = 400;
export const CAPA_BYTES = 150 * 1024;

export const FOTO_LADO = 256;
export const FOTO_BYTES = 50 * 1024;

interface Alvo {
  largura: number;
  altura: number;
  bytes: number;
  /** Abaixo disto não encolhe mais: a imagem ficaria ruim de ver. */
  larguraMinima: number;
}

const CAPA: Alvo = { largura: CAPA_LARGURA, altura: CAPA_ALTURA, bytes: CAPA_BYTES, larguraMinima: 300 };
const FOTO: Alvo = { largura: FOTO_LADO, altura: FOTO_LADO, bytes: FOTO_BYTES, larguraMinima: 64 };

// Qualidades tentadas, da melhor para a menor; se nem a menor cabe no
// limite, a imagem encolhe 25% e tenta de novo.
const QUALIDADES = [0.85, 0.7, 0.55, 0.4];

/** O recorte do meio da foto na proporção do alvo e o tamanho final (nunca
 *  maior que a foto), para nada ficar esticado nem com faixa preta. */
function medidasDoRecorte(largura: number, altura: number, alvo: Pick<Alvo, 'largura' | 'altura'>) {
  const proporcao = alvo.largura / alvo.altura;
  const recorte =
    largura / altura > proporcao
      ? { largura: Math.round(altura * proporcao), altura }
      : { largura, altura: Math.round(largura / proporcao) };
  const x = Math.round((largura - recorte.largura) / 2);
  const y = Math.round((altura - recorte.altura) / 2);
  const escala = Math.min(1, alvo.largura / recorte.largura);
  return {
    x,
    y,
    recorte,
    final: {
      largura: Math.max(1, Math.round(recorte.largura * escala)),
      altura: Math.max(1, Math.min(alvo.altura, Math.round(recorte.altura * escala))),
    },
  };
}

/** O recorte 3:1 do meio da foto e o tamanho final da capa. */
export function medidasDaCapa(largura: number, altura: number) {
  return medidasDoRecorte(largura, altura, CAPA);
}

/** O quadrado do meio e o tamanho final da foto de perfil. */
export function medidasDaFoto(largura: number, altura: number) {
  return medidasDoRecorte(largura, altura, FOTO);
}

/** O arquivo escolhido, pronto para api.turmas.enviarCapa. Rejeita com uma
 *  mensagem para a tela quando não dá. */
export function imagemDaCapa(arquivo: Blob): Promise<string> {
  return imagemWebp(arquivo, CAPA);
}

/** O arquivo escolhido, pronto para api.conta.enviarFoto (ou a do aluno). */
export function imagemDaFoto(arquivo: Blob): Promise<string> {
  return imagemWebp(arquivo, FOTO);
}

async function imagemWebp(arquivo: Blob, alvo: Alvo): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não deu para abrir esse arquivo. Escolha uma imagem JPG, PNG ou WEBP.');
  }
  try {
    const { x, y, recorte, final } = medidasDoRecorte(bitmap.width, bitmap.height, alvo);
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
        if (blob.size <= alvo.bytes) return await comoDataUrl(blob);
      }
      if (largura * 0.75 < alvo.larguraMinima) {
        throw new Error(`Essa imagem não coube em ${alvo.bytes / 1024} KB. Tente outra, com menos detalhes.`);
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
