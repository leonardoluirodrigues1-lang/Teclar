// comum.ts
// O que Login.tsx e Cadastro.tsx compartilham e NÃO é React: a tradução
// de erro da API. Tudo aqui é utilidade pura — função que recebe valor e
// devolve valor. O campo de estrelas que morava aqui foi para
// js/componentes/campoDeEstrelas.ts, que agora serve todas as telas. As peças de FORMULÁRIO que o comum.js tinha (erro
// embaixo do campo, botão ocupado, mostrar/esconder senha) viraram estado,
// hook e componente em ./Formulario.tsx, porque dependem do ciclo de
// render. Regra de dedo: se só uma tela usa, mora na tela.
//
// A "escolha de perfil" que morava aqui (?perfil= na URL + sessionStorage)
// saiu: o login vem antes de qualquer escolha, e Solo/Professor é modo da
// conta, gravado pelo sessao.ts depois do login — não perfil.

// ============================================================================
// 1. Erros da API traduzidos para a tela
// ============================================================================
// A tela decide pelo CÓDIGO, nunca pela mensagem do servidor: texto de back
// muda, vem em inglês, vem com detalhe técnico ou vaza informação. E o
// status HTTP nunca aparece para a pessoa.

export const MENSAGENS = {
  CREDENCIAIS: 'E-mail ou senha incorretos.',
  CREDENCIAIS_ALUNO: 'RP ou senha de aluno incorretos.',
  INATIVA: 'Esta conta está desativada.',
  CONEXAO: 'Não foi possível conectar. Tente de novo.',
};

/** A forma que se lê de um erro de API, seja o ErroApi ou o do mock. */
interface ErroComStatus {
  name?: string;
  status?: number;
}

/**
 * Traduz a falha de uma chamada de autenticação.
 * `credenciais` é a frase do 401 desta tela (muda entre e-mail e RP).
 * O 409 NÃO passa por aqui: ele é erro de campo, e quem chama trata.
 */
export function mensagemDoErro(
  excecao: unknown,
  { credenciais = MENSAGENS.CREDENCIAIS }: { credenciais?: string } = {}
): string {
  // Duck typing, não instanceof: o erro do mock (js/nucleo/mocks.ts) tem a
  // mesma forma do ErroApi mas não é instância dele.
  const erro = excecao as ErroComStatus | null | undefined;
  const daApi = erro?.name === 'ErroApi';

  if (daApi && erro.status === 401) return credenciais;
  if (daApi && erro.status === 403) return MENSAGENS.INATIVA;

  // Erro que não veio da API (bug, resposta fora do formato) some da tela,
  // mas não do console — é lá que ele serve para alguma coisa.
  if (!daApi) console.error(excecao);

  // Todo o resto — 500, 501, rede fora — é a mesma frase para quem está na
  // tela. Status HTTP e texto cru do servidor nunca aparecem.
  return MENSAGENS.CONEXAO;
}

/** O 409 do cadastro: e-mail já com conta. Quem chama mostra no campo. */
export function ehConflito(excecao: unknown): boolean {
  const erro = excecao as ErroComStatus | null | undefined;
  return erro?.name === 'ErroApi' && erro.status === 409;
}
