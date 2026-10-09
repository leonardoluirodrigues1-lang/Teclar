// regras-do-cadastro.ts
// As regras dos campos do POST /auth/cadastro: nome, e-mail e a senha de
// CONTA (Users), que é a regra forte. A senha de ALUNO é outra, mais
// branda, e fica em senha-do-aluno.ts.
//
// A mesma regra existe no front, em js/utils/validacao.ts (validarNome,
// validarEmail, validarSenha), com os mesmos limites e as mesmas
// mensagens. Está repetida porque o back não importa código do front; se
// uma mudar, a outra muda junto. O back confere de novo porque a tela não
// é a única que chama a rota: um curl pula toda validação do front.
//
// Cada função devolve null quando o valor serve, e a mensagem pronta
// quando não serve.

// Os limites de tamanho são os da tabela Users: Nome e Email são
// VARCHAR(150). Passar disso seria erro 500 no INSERT, em vez de 400.
const NOME_MINIMO = 2;
const NOME_MAXIMO = 150;
const EMAIL_MAXIMO = 150;
const SENHA_MINIMO = 8;

// Formato simples de propósito, o mesmo do front: algo@algo.algo, sem
// espaço. Quem garante que o e-mail existe é quem o usa, não uma regex.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEM_LETRA = /[A-Za-zÀ-ÿ]/;
const TEM_NUMERO = /\d/;

// O nome chega já aparado (quem chama apara antes de gravar).
export function problemaNoNome(nome: string): string | null {
  if (nome.length === 0) {
    return 'Informe o seu nome.';
  }
  if (nome.length < NOME_MINIMO) {
    return 'O nome precisa de pelo menos 2 caracteres.';
  }
  if (nome.length > NOME_MAXIMO) {
    return 'O nome pode ter no máximo 150 caracteres.';
  }
  return null;
}

// O e-mail chega já aparado e minúsculo.
export function problemaNoEmail(email: string): string | null {
  if (email.length === 0) {
    return 'Informe o seu e-mail.';
  }
  if (email.length > EMAIL_MAXIMO) {
    return 'O e-mail pode ter no máximo 150 caracteres.';
  }
  if (!FORMATO_EMAIL.test(email)) {
    return 'Digite um e-mail válido.';
  }
  return null;
}

// A senha chega SEM aparar: é exatamente a que vai virar hash.
//
// Por que recusar espaço nas pontas em vez de aparar: o login apara a
// senha antes de conferir (senha colada costuma trazer espaço no fim). Se
// o cadastro aceitasse " abc12345", o hash seria do texto com espaço, o
// login compararia sem espaço, e a pessoa ficaria trancada para fora.
export function problemaNaSenhaDaConta(senha: string): string | null {
  if (senha.length === 0) {
    return 'Informe uma senha.';
  }
  if (senha !== senha.trim()) {
    return 'A senha não pode começar nem terminar com espaço.';
  }
  if (senha.length < SENHA_MINIMO) {
    return 'A senha precisa de pelo menos 8 caracteres.';
  }
  if (!TEM_LETRA.test(senha) || !TEM_NUMERO.test(senha)) {
    return 'A senha precisa ter pelo menos uma letra e um número.';
  }
  return null;
}
