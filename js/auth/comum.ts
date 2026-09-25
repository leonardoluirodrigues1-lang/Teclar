// comum.ts
// O que Login.tsx e Cadastro.tsx compartilham e NÃO é React: o campo de
// estrelas do fundo e a tradução de erro da API. Tudo aqui é utilidade
// pura — função que recebe valor e devolve valor, ou que pinta um host
// fora da raiz do React. As peças de FORMULÁRIO que o comum.js tinha (erro
// embaixo do campo, botão ocupado, mostrar/esconder senha) viraram estado,
// hook e componente em ./Formulario.tsx, porque dependem do ciclo de
// render. Regra de dedo: se só uma tela usa, mora na tela.
//
// A "escolha de perfil" que morava aqui (?perfil= na URL + sessionStorage)
// saiu: o login vem antes de qualquer escolha, e Solo/Professor é modo da
// conta, gravado pelo sessao.ts depois do login — não perfil.

import { rng } from '../landing/letras.js';

// ============================================================================
// 1. Campo de estrelas
// ============================================================================
// Mesmo gerador pseudoaleatório da landing (rng de js/landing/letras.ts),
// com semente fixa: a composição é sempre a mesma a cada recarga. Enquanto
// a landing era .js fonte este arquivo tinha uma CÓPIA do gerador (um .ts
// importando .js fonte dispara o TS5055, ver tsconfig.json); agora que
// letras é .ts, o import direto voltou e a cópia foi apagada.

const SEMENTE_ESTRELAS = 20260912;
const QUANTIDADE_ESTRELAS = 60;

// Espalha pontos de 1 a 3px, opacidade .10–.55, dentro de `host`.
// O host (#estrelas) fica no .fundo, fora da raiz do React: continua sendo
// pintado por DOM direto, uma vez, antes de o React montar.
export function montarEstrelas(host: HTMLElement | null, quantidade = QUANTIDADE_ESTRELAS): void {
  if (!host) return;
  const rand = rng(SEMENTE_ESTRELAS);
  const frag = document.createDocumentFragment();

  for (let i = 0; i < quantidade; i++) {
    const e = document.createElement('span');
    e.className = 'estrela';
    const tamanho = 1 + rand() * 2;
    e.style.left = (rand() * 100).toFixed(2) + '%';
    e.style.top = (rand() * 100).toFixed(2) + '%';
    e.style.width = tamanho.toFixed(2) + 'px';
    e.style.height = tamanho.toFixed(2) + 'px';
    e.style.opacity = (0.10 + rand() * 0.45).toFixed(2);
    frag.appendChild(e);
  }

  host.appendChild(frag);
}

// ============================================================================
// 2. Erros da API traduzidos para a tela
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
