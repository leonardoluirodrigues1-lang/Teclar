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

// 1. Erros da API traduzidos para a tela
// A tela decide pelo CÓDIGO, nunca pela mensagem do servidor: texto de back
// muda, vem em inglês, vem com detalhe técnico ou vaza informação. E o
// status HTTP nunca aparece para a pessoa.

import { validarNome, validarSenhaAluno } from '../utils/validacao.js';

export const MENSAGENS = {
  CREDENCIAIS: 'E-mail ou senha incorretos.',
  INATIVA: 'Esta conta está desativada.',
  INATIVA_ALUNO: 'Esta turma foi arquivada ou o seu acesso foi desativado. Fale com o professor.',
  // O 400 do login de aluno só acontece no PRIMEIRO ACESSO: a senha
  // digitada ia ser gravada e não segue a regra. A tela já confere antes
  // (validarSenhaAluno); isto é a rede de segurança.
  SENHA_PRIMEIRO_ACESSO: 'A senha precisa ter de 6 a 20 caracteres, com letras e números.',
  // 429 do login: 5 senhas erradas no mesmo minuto (back/src/autenticacao/tentativas-de-login.ts).
  MUITAS_TENTATIVAS: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
  CONEXAO: 'Não foi possível conectar. Tente de novo.',
};

/** A forma que se lê de um erro de API, seja o ErroApi ou o do mock. */
interface ErroComStatus {
  name?: string;
  status?: number;
  codigo?: string | null;
}

/**
 * Traduz a falha de uma chamada de autenticação.
 * `credenciais` é a frase do 401 desta tela (muda entre conta e aluno);
 * `inativa`, a do 403; `dadosInvalidos`, a do 400 (só o login de aluno tem).
 * O 409 NÃO passa por aqui: ele é erro de campo, e quem chama trata.
 */
export function mensagemDoErro(
  excecao: unknown,
  {
    credenciais = MENSAGENS.CREDENCIAIS,
    inativa = MENSAGENS.INATIVA,
    dadosInvalidos,
  }: { credenciais?: string; inativa?: string; dadosInvalidos?: string } = {}
): string {
  // Duck typing, não instanceof: o erro do mock (js/nucleo/mocks.ts) tem a
  // mesma forma do ErroApi mas não é instância dele.
  const erro = excecao as ErroComStatus | null | undefined;
  const daApi = erro?.name === 'ErroApi';

  if (daApi && erro.status === 401) return credenciais;
  if (daApi && erro.status === 403) return inativa;
  if (daApi && erro.status === 429) return MENSAGENS.MUITAS_TENTATIVAS;
  if (daApi && erro.status === 400 && erro.codigo === 'DADOS_INVALIDOS' && dadosInvalidos) return dadosInvalidos;

  // Erro que não veio da API (bug, resposta fora do formato) some da tela,
  // mas não do console — é lá que ele serve para alguma coisa.
  if (!daApi) console.error(excecao);

  // Todo o resto — 500, 501, rede fora — é a mesma frase para quem está na
  // tela. Status HTTP e texto cru do servidor nunca aparecem.
  return MENSAGENS.CONEXAO;
}

// --- Entrada do aluno (os dois passos do Login.tsx) --------------------------

export const MENSAGENS_DO_ALUNO = {
  CODIGO_NAO_EXISTE: 'Não achamos nenhuma turma com esse código. Confira as letras e os números com o professor.',
  TURMA_ARQUIVADA: 'Esta turma foi arquivada. Fale com o professor.',
  SENHA_INCORRETA: 'Senha incorreta. Se esqueceu, peça ao professor uma senha provisória.',
  NOME_EM_USO: 'Já tem alguém com esse nome nesta turma. Se não é você, use também seu sobrenome.',
  CODIGOS_DEMAIS: 'Muitos códigos errados seguidos. Espere um minuto e tente de novo.',
};

/** Passo 1: o código não serviu. */
export function mensagemDoCodigo(excecao: unknown): string {
  const erro = excecao as ErroComStatus | null | undefined;
  if (erro?.name === 'ErroApi' && erro.status === 404) return MENSAGENS_DO_ALUNO.CODIGO_NAO_EXISTE;
  if (erro?.name === 'ErroApi' && erro.status === 403) return MENSAGENS_DO_ALUNO.TURMA_ARQUIVADA;
  // 429: códigos errados demais deste computador (o limite por IP do back).
  if (erro?.name === 'ErroApi' && erro.status === 429) return MENSAGENS_DO_ALUNO.CODIGOS_DEMAIS;
  return mensagemDoErro(excecao);
}

/** Passo 2: entrar ou matricular não deu certo. No 400 (primeiro acesso
 *  fora da regra) a tela repete a regra aqui, com a mesma frase do back. */
export function mensagemDaEntrada(excecao: unknown, nome: string, senha: string): string {
  const erro = excecao as ErroComStatus | null | undefined;
  const daApi = erro?.name === 'ErroApi';
  if (daApi && erro.status === 401) return MENSAGENS_DO_ALUNO.SENHA_INCORRETA;
  if (daApi && erro.status === 409) return MENSAGENS_DO_ALUNO.NOME_EM_USO;
  if (daApi && erro.status === 403 && erro.codigo === 'TURMA_ARQUIVADA') return MENSAGENS_DO_ALUNO.TURMA_ARQUIVADA;
  if (daApi && erro.status === 400) {
    return validarNome(nome) ?? validarSenhaAluno(senha.trim()) ?? MENSAGENS.SENHA_PRIMEIRO_ACESSO;
  }
  return mensagemDoErro(excecao, { inativa: MENSAGENS.INATIVA_ALUNO });
}

/** O 409 do cadastro: e-mail já com conta. Quem chama mostra no campo. */
export function ehConflito(excecao: unknown): boolean {
  const erro = excecao as ErroComStatus | null | undefined;
  return erro?.name === 'ErroApi' && erro.status === 409;
}
