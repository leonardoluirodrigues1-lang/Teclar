// validacao.ts
// Regras de campo do formulário, sem DOM e sem texto de interface espalhado.
// Cada validador devolve `null` quando o valor está bom e a MENSAGEM pronta
// quando está ruim — quem chama só pergunta "tem erro?" e imprime embaixo do
// campo. Nada aqui chama alert, nada aqui mexe em elemento.
//
// Os limites são os mesmos da tabela Users no banco (VARCHAR(150) em Nome e
// Email). Validar aqui com número diferente do back é mentir para a pessoa:
// ou ela é barrada à toa, ou passa e toma erro 500 do outro lado.

/** Todo validador devolve null quando o valor está bom e a MENSAGEM pronta
 *  quando está ruim. */
export type Validacao = string | null;

export const LIMITES = {
  NOME_MIN: 2,
  NOME_MAX: 150,
  EMAIL_MAX: 150,
  SENHA_MIN: 8,
  SENHA_ALUNO_MIN: 4,
  SENHA_ALUNO_MAX: 20,
  TURMA_MIN: 3,
  TURMA_MAX: 100,
  EXERCICIO_TITULO_MIN: 3,
  EXERCICIO_TITULO_MAX: 100,
  EXERCICIO_TEXTO_MIN: 20,
  EXERCICIO_TEXTO_MAX: 2000,
  EXERCICIO_TEMPO_MAX: 3600,
};

// Formato de e-mail deliberadamente simples: algo@algo.algo, sem espaço.
// Regex de e-mail "completa" (RFC 5322) é enorme, ilegível e ainda assim
// recusa endereço válido. Quem diz a palavra final é o back ao gravar.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Pelo menos uma letra e pelo menos um dígito, em qualquer ordem.
const TEM_LETRA = /[A-Za-zÀ-ÿ]/;
const TEM_NUMERO = /\d/;

/** 2 a 150 caracteres. Espaço nas pontas não conta. */
export function validarNome(valor: unknown): Validacao {
  const nome = String(valor ?? '').trim();
  if (nome.length === 0) return 'Informe o seu nome.';
  if (nome.length < LIMITES.NOME_MIN) return 'O nome precisa de pelo menos 2 caracteres.';
  if (nome.length > LIMITES.NOME_MAX) return 'O nome pode ter no máximo 150 caracteres.';
  return null;
}

/** Formato válido e até 150 caracteres. */
export function validarEmail(valor: unknown): Validacao {
  const email = String(valor ?? '').trim();
  if (email.length === 0) return 'Informe o seu e-mail.';
  if (email.length > LIMITES.EMAIL_MAX) return 'O e-mail pode ter no máximo 150 caracteres.';
  if (!FORMATO_EMAIL.test(email)) return 'Digite um e-mail válido.';
  return null;
}

// O login apara as pontas da senha (um espaço colado junto fazia a pessoa
// tomar "senha incorreta" sem motivo). Para isso não trancar ninguém para
// fora, o cadastro recusa senha que comece ou termine com espaço: assim
// nenhuma senha válida perde nada no trim. Espaço no MEIO continua valendo.
// Aqui não se apara nada: a senha validada é exatamente a que é enviada.
/** Mínimo de 8 caracteres, com pelo menos uma letra e um número, sem
 *  espaço nas pontas. */
export function validarSenha(valor: unknown): Validacao {
  const senha = String(valor ?? '');
  if (senha.length === 0) return 'Informe uma senha.';
  if (senha !== senha.trim()) return 'A senha não pode começar nem terminar com espaço.';
  if (senha.length < LIMITES.SENHA_MIN) return 'A senha precisa de pelo menos 8 caracteres.';
  if (!TEM_LETRA.test(senha) || !TEM_NUMERO.test(senha)) {
    return 'A senha precisa ter pelo menos uma letra e um número.';
  }
  return null;
}

/** Confirmação: tem de ser idêntica à senha. */
export function validarConfirmacao(senha: unknown, confirmacao: unknown): Validacao {
  const valor = String(confirmacao ?? '');
  if (valor.length === 0) return 'Repita a senha.';
  if (valor !== String(senha ?? '')) return 'As senhas não são iguais.';
  return null;
}

// --- Escola ----------------------------------------------------------------

/**
 * Nome da turma: obrigatório, 3 a 100 caracteres.
 * O limite de cima é o VARCHAR(100) da coluna Nome da tabela Turmas; o de
 * baixo existe para "9A" não virar uma turma que ninguém reconhece na lista
 * daqui a um semestre.
 */
export function validarNomeTurma(valor: unknown): Validacao {
  const nome = String(valor ?? '').trim();
  if (nome.length === 0) return 'Dê um nome para a turma.';
  if (nome.length < LIMITES.TURMA_MIN) return 'O nome precisa de pelo menos 3 caracteres.';
  if (nome.length > LIMITES.TURMA_MAX) return 'O nome pode ter no máximo 100 caracteres.';
  return null;
}

// --- Biblioteca (exercício do professor) -----------------------------------
// O texto é o que o aluno vai digitar, então o tamanho é contado nele mesmo
// — não há coluna de tamanho no banco. A quebra de linha NÃO é erro aqui:
// o motor de digitação trabalha com uma linha contínua, e a tela troca a
// quebra por espaço ao salvar (ver normalizarTextoExercicio), avisando.

/** Título: obrigatório, 3 a 100 caracteres. Espaço nas pontas não conta. */
export function validarTituloExercicio(valor: unknown): Validacao {
  const titulo = String(valor ?? '').trim();
  if (titulo.length === 0) return 'Dê um título ao exercício.';
  if (titulo.length < LIMITES.EXERCICIO_TITULO_MIN) return 'O título precisa de pelo menos 3 caracteres.';
  if (titulo.length > LIMITES.EXERCICIO_TITULO_MAX) return 'O título pode ter no máximo 100 caracteres.';
  return null;
}

/** Quebras de linha viram espaço (uma por quebra, seja \n, \r\n ou \r) e as
 *  pontas são aparadas. É o texto que vai para o banco e para a contagem. */
export function normalizarTextoExercicio(valor: unknown): string {
  return String(valor ?? '').replace(/\r\n|\r|\n/g, ' ').trim();
}

/** Texto: obrigatório, 20 a 2000 caracteres, contados já sem as quebras. */
export function validarTextoExercicio(valor: unknown): Validacao {
  const texto = normalizarTextoExercicio(valor);
  if (texto.length === 0) return 'Escreva o texto do exercício.';
  if (texto.length < LIMITES.EXERCICIO_TEXTO_MIN) return 'O texto precisa de pelo menos 20 caracteres.';
  if (texto.length > LIMITES.EXERCICIO_TEXTO_MAX) return 'O texto pode ter no máximo 2000 caracteres.';
  return null;
}

/** Tempo limite em segundos: inteiro de 0 (sem limite) a 3600. */
export function validarTempoLimite(valor: unknown): Validacao {
  const texto = String(valor ?? '').trim();
  if (texto.length === 0) return 'Informe o tempo limite (0 = sem limite).';
  const segundos = Number(texto);
  if (!Number.isInteger(segundos)) return 'O tempo limite é um número inteiro de segundos.';
  if (segundos < 0 || segundos > LIMITES.EXERCICIO_TEMPO_MAX) {
    return 'O tempo limite vai de 0 a 3600 segundos.';
  }
  return null;
}

// --- Login -----------------------------------------------------------------
// No login não se valida força de senha: a senha correta pode ser antiga e
// não seguir a regra de hoje. Só se confere que o campo não está vazio —
// quem julga o resto é o back.

// A senha do login é aparada nas pontas, a de conta e a de aluno: quem cola
// a senha costuma trazer um espaço ou uma quebra de linha junto. A de conta
// não pode ter espaço nas pontas desde o cadastro (validarSenha); a de aluno
// é gravada já aparada no primeiro acesso, então também nunca tem.

/** Campo de senha do login: só não pode estar vazio. Só espaço conta como
 *  vazio, porque é aparado antes de ir para o back (ver Login.tsx). */
export function validarSenhaLogin(valor: unknown): Validacao {
  return String(valor ?? '').trim().length === 0 ? 'Informe a senha.' : null;
}

/**
 * Senha de ALUNO: de 4 a 20 caracteres, qualquer coisa serve — quem digita
 * é criança, e não se exige letra, número nem símbolo. Conta-se depois de
 * aparar as pontas, porque é assim que ela vai para o back e é gravada.
 * A mensagem diz só quantos caracteres faltam. Vale no login do aluno
 * (que no primeiro acesso grava essa senha) e em qualquer outro lugar que
 * valide senha de aluno. A senha de CONTA continua em validarSenha.
 */
export function validarSenhaAluno(valor: unknown): Validacao {
  const senha = String(valor ?? '').trim();
  const faltam = LIMITES.SENHA_ALUNO_MIN - senha.length;
  if (faltam > 0) return faltam === 1 ? 'Falta 1 caractere.' : `Faltam ${faltam} caracteres.`;
  if (senha.length > LIMITES.SENHA_ALUNO_MAX) return 'A senha pode ter no máximo 20 caracteres.';
  return null;
}

// --- Código da turma (o login do aluno) -------------------------------------
// O back gera o código ao criar a turma: 6 caracteres de A-Z e 2-9. Quem o
// copia da lousa digita com espaço ou minúsculo; os dois viram a forma do
// banco antes de validar e antes de enviar. O formato não é conferido aqui
// além do tamanho: código errado é o mesmo 401 de senha errada.

/** " k7m 2qx" -> "K7M2QX". Tira todo espaço e põe em maiúscula. */
export function normalizarCodigo(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Código da turma: obrigatório, até 12 caracteres (o VARCHAR(12)). */
export function validarCodigo(valor: unknown): Validacao {
  const codigo = normalizarCodigo(valor);
  if (codigo.length === 0) return 'Informe o código da turma.';
  if (codigo.length > 12) return 'O código da turma tem no máximo 12 caracteres.';
  return null;
}
