// texto-limpo.ts
// Um pedaço de texto que uma pessoa digita (nome de aluno, de turma, de
// categoria, título de exercício) não tem caractere de controle nem
// surrogate solto: são lixo que não aparece num teclado, passam direto
// pela validação de tamanho e só servem para quebrar quem exibe o texto
// depois. Os validadores de nome e de título usam isto no mesmo lugar em
// que conferem o tamanho, para o 400 sair limpo em vez de gravar o lixo.

// Controle C0 e C1, incluindo o byte nulo (\u0000). As quebras de linha e o
// tab já viram espaço no normalizarNome/título antes daqui; o que sobra
// aqui é controle que ninguém digita de propósito.
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;

// Surrogate alto sem o baixo, ou baixo sem o alto: string malformada (um
// \uD800 solto, por exemplo), que o MySQL recusaria no utf8mb4.
const SURROGATE_SOLTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function temCaractereDeControle(texto: string): boolean {
  return CONTROLE.test(texto) || SURROGATE_SOLTO.test(texto);
}
