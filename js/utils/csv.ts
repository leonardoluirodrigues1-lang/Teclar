// Parser de CSV feito à mão, sem biblioteca. Existe para a importação de
// alunos (pages/professor/alunos.html), mas não sabe nada de aluno: recebe
// texto, devolve linhas de células. Sem fetch; o único toque no DOM é o
// baixarCsv(), no fim, que entrega o arquivo ao navegador.
//
// O que ele aguenta, porque é o que chega de verdade de uma planilha:
//   · separador vírgula, ponto e vírgula OU tab — o Excel em português
//     salva com ";" e ninguém avisa; "Texto (separado por tabulações)" usa tab;
//   · arquivo em windows-1252 (o "CSV" do Excel BR) — decodificarCsv();
//   · BOM (U+FEFF) no começo — o Excel põe, e sem tirar a primeira coluna
//     vira "\uFEFFmatricula" e nunca casa com "matricula";
//   · campo entre aspas, com o separador dentro e com aspas duplicadas
//     ("" é uma aspa literal, como manda o RFC 4180);
//   · quebra de linha CRLF (Windows) e LF, inclusive dentro de aspas;
//   · espaço em volta dos valores — cortado;
//   · linha em branco — vem como uma célula vazia só, na posição dela, para
//     a tela numerar as linhas como a planilha numera (quem a descarta é a
//     tela, não o parser).
//
// Cabeçalho: o parser não decide sozinho se a primeira linha é cabeçalho
// ou dado — isso depende de quais colunas a tela espera. separarCabecalho()
// faz essa decisão a partir de uma lista de nomes conhecidos.

const BOM = '\uFEFF';
const SEPARADORES: readonly string[] = [',', ';', '	'];

/** Os separadores que o parser aceita. */
export type Separador = ',' | ';' | '	';

/**
 * Bytes do arquivo -> texto. Tenta UTF-8; se aparecer o caractere de
 * substituição (U+FFFD), o arquivo não era UTF-8 — quase sempre é o
 * windows-1252 do Excel BR — e decodifica de novo assim. Sem BOM na saída.
 */
export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const texto = utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
  return texto.startsWith(BOM) ? texto.slice(1) : texto;
}

/**
 * Descobre o separador olhando só a primeira linha com conteúdo: conta
 * vírgulas, pontos e vírgulas e tabs FORA de aspas e fica com o que
 * aparecer mais. Empate ou nenhum: vírgula, o padrão do formato.
 */
export function detectarSeparador(texto: string | null | undefined): Separador {
  const primeira = String(texto ?? '')
    .replace(BOM, '')
    .split(/\r\n|\n|\r/)
    .find((l) => l.trim() !== '');
  if (!primeira) return ',';

  const contagem: Record<Separador, number> = { ',': 0, ';': 0, '	': 0 };
  let dentroDeAspas = false;
  for (const ch of primeira) {
    if (ch === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas && ch in contagem) contagem[ch as Separador]++;
  }
  return (Object.keys(contagem) as Separador[]).reduce((a, b) => (contagem[b] > contagem[a] ? b : a));
}

/**
 * Texto -> array de linhas, cada linha um array de células (string).
 * Devolve { linhas, separador }.
 *
 * Máquina de estados de um caractere por vez: é o único jeito de tratar
 * aspas direito. Dividir por regex quebra no primeiro campo com separador
 * ou quebra de linha dentro das aspas.
 */
export function parsearCsv(
  texto: string | null | undefined,
  { separador }: { separador?: string } = {}
): { linhas: string[][]; separador: Separador } {
  let fonte = String(texto ?? '');
  if (fonte.startsWith(BOM)) fonte = fonte.slice(1);

  const sep: Separador = SEPARADORES.includes(separador)
    ? (separador as Separador)
    : detectarSeparador(fonte);

  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let dentroDeAspas = false;

  const fecharCelula = () => {
    linha.push(celula.trim());
    celula = '';
  };
  const fecharLinha = () => {
    fecharCelula();
    linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < fonte.length; i++) {
    const ch = fonte[i];

    if (dentroDeAspas) {
      if (ch === '"') {
        // "" dentro de aspas é uma aspa literal; " sozinha fecha o campo.
        if (fonte[i + 1] === '"') {
          celula += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        celula += ch;
      }
      continue;
    }

    if (ch === '"') {
      dentroDeAspas = true;
    } else if (ch === sep) {
      fecharCelula();
    } else if (ch === '\r') {
      // CRLF: o \n logo em seguida é consumido junto. \r sozinho (Mac
      // clássico) também fecha a linha.
      if (fonte[i + 1] === '\n') i++;
      fecharLinha();
    } else if (ch === '\n') {
      fecharLinha();
    } else {
      celula += ch;
    }
  }

  // Última linha sem quebra no fim do arquivo.
  if (celula !== '' || linha.length > 0) fecharLinha();

  return { linhas, separador: sep };
}

// Sem acento, minúsculas, sem espaço nas pontas — para "Matrícula",
// "MATRICULA" e " matricula " serem a mesma coluna.
function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/**
 * Decide se a primeira linha com conteúdo é cabeçalho. É cabeçalho quando
 * ALGUMA célula dela, normalizada, é um dos nomes conhecidos —
 * "matricula;nome" é cabeçalho e a coluna é a segunda. Uma primeira linha
 * "20251043" não é nome de coluna, então é dado, e nada se perde.
 *
 * Devolve { cabecalho: string[] | null, coluna, dados, primeiraLinha }, em
 * que coluna é o índice da primeira célula conhecida (0 sem cabeçalho) e
 * primeiraLinha é o número (a partir de 1, como na planilha) da linha do
 * arquivo que corresponde a dados[0] — linhas em branco antes do cabeçalho
 * e o próprio cabeçalho já contados.
 */
export function separarCabecalho(
  linhas: string[][],
  colunasConhecidas?: string[] | null
): { cabecalho: string[] | null; coluna: number; dados: string[][]; primeiraLinha: number } {
  const conhecidas = new Set((colunasConhecidas ?? []).map(normalizar));
  const indice = linhas.findIndex((l) => l.some((c) => c !== ''));
  if (indice < 0) return { cabecalho: null, coluna: 0, dados: [], primeiraLinha: 1 };

  const primeira = linhas[indice];
  const coluna = primeira.findIndex((c) => conhecidas.has(normalizar(c)));
  const ehCabecalho = coluna >= 0;
  const inicio = ehCabecalho ? indice + 1 : indice;

  return {
    cabecalho: ehCabecalho ? primeira : null,
    coluna: Math.max(coluna, 0),
    dados: linhas.slice(inicio),
    primeiraLinha: inicio + 1,
  };
}

/**
 * O caminho inverso: linhas de células -> texto CSV. Usado para o modelo
 * de download e para devolver as linhas que falharam. Célula com o
 * separador, aspas ou quebra de linha vai entre aspas, com as aspas
 * internas dobradas. CRLF no fim de cada linha, que é o que o Excel espera.
 *
 * `bom: true` põe o U+FEFF na frente: é o que faz o Excel abrir o arquivo
 * como UTF-8 em vez de Latin-1 (e o parsearCsv daqui tira de volta).
 */
export function gerarCsv(
  linhas: ReadonlyArray<ReadonlyArray<unknown>>,
  { separador = ',', bom = false }: { separador?: string; bom?: boolean } = {}
): string {
  const precisaDeAspas = (valor: string) =>
    valor.includes(separador) || valor.includes('"') || /[\r\n]/.test(valor);

  const escapar = (valor: unknown) => {
    const texto = String(valor ?? '');
    return precisaDeAspas(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const corpo = linhas.map((linha) => linha.map(escapar).join(separador)).join('\r\n') + '\r\n';
  return bom ? BOM + corpo : corpo;
}

// Download — saiu de professor/Relatorios.tsx quando o relatório do aluno
// (aluno/Sala.tsx) também passou a exportar CSV.

// Um nome de turma em pedaço de nome de arquivo: minúsculas e sem acento.
// Fora disso, o que não é letra nem número vira hífen — "9º Ano A — Manhã" tem espaço, ordinal e travessão, e um nome de
// arquivo com isso dentro é um convite a problema no download.
export function slug(nome: string): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'turma';
}

// Ponto e vírgula como separador e BOM na frente: é o par que faz o Excel
// em português abrir o arquivo em colunas e em UTF-8, em vez de jogar tudo
// na coluna A com os acentos quebrados. O gerarCsv, acima, já põe o
// BOM e já escapa a célula que contenha o separador.
export function baixarCsv(nomeArquivo: string, linhas: (string | number)[][]): void {
  const csv = gerarCsv(linhas, { separador: ';', bom: true });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Um instante depois: revogar na hora cancela o download em alguns
  // navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
