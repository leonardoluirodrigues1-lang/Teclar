// O Markdown simples das instruções da atividade (o post do professor):
// parágrafos, **negrito**, *itálico*, listas (- ou 1.) e [links](https://...).
// Sai uma árvore de dados, não HTML: quem desenha é componentes/Instrucoes.tsx,
// com elementos React. Nada vira innerHTML, então um <script> ou um
// onerror= digitado nas instruções aparece como texto e não executa. Link
// só com http/https: javascript:, data: e afins ficam como texto.

export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito' | 'italico'; filhos: Trecho[] }
  | { tipo: 'link'; href: string; filhos: Trecho[] };

export type BlocoMd =
  | { tipo: 'paragrafo'; linhas: Trecho[][] }
  | { tipo: 'lista' | 'numerada'; itens: Trecho[][] };

const ITEM = /^\s*[-*]\s+(.*)$/;
const NUMERADO = /^\s*\d+[.)]\s+(.*)$/;

export function lerMarkdown(fonte: string): BlocoMd[] {
  const blocos: BlocoMd[] = [];
  for (const pedaco of String(fonte ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const linhas = pedaco.split('\n').filter((linha) => linha.trim() !== '');
    if (linhas.length === 0) continue;
    if (linhas.every((l) => ITEM.test(l))) {
      blocos.push({ tipo: 'lista', itens: linhas.map((l) => lerTrechos(l.match(ITEM)![1])) });
    } else if (linhas.every((l) => NUMERADO.test(l))) {
      blocos.push({ tipo: 'numerada', itens: linhas.map((l) => lerTrechos(l.match(NUMERADO)![1])) });
    } else {
      blocos.push({ tipo: 'paragrafo', linhas: linhas.map((l) => lerTrechos(l.trim())) });
    }
  }
  return blocos;
}

export function hrefSeguro(url: string): string | null {
  try {
    const lida = new URL(url);
    return lida.protocol === 'http:' || lida.protocol === 'https:' ? lida.href : null;
  } catch {
    return null;
  }
}

// O primeiro marcador que aparece vence; o que vem antes é texto.
const MARCAS = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\*(.+?)\*|_(.+?)_/;

export function lerTrechos(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  let resto = texto;
  while (resto) {
    const achado = MARCAS.exec(resto);
    if (!achado) {
      saida.push({ tipo: 'texto', texto: resto });
      break;
    }
    if (achado.index > 0) saida.push({ tipo: 'texto', texto: resto.slice(0, achado.index) });
    const [inteiro, negrito, rotulo, url, italico, italico2] = achado;
    if (negrito !== undefined) saida.push({ tipo: 'negrito', filhos: lerTrechos(negrito) });
    else if (rotulo !== undefined) {
      const href = hrefSeguro(url);
      saida.push(href ? { tipo: 'link', href, filhos: lerTrechos(rotulo) } : { tipo: 'texto', texto: inteiro });
    } else saida.push({ tipo: 'italico', filhos: lerTrechos(italico ?? italico2) });
    resto = resto.slice(achado.index + inteiro.length);
  }
  return saida;
}
