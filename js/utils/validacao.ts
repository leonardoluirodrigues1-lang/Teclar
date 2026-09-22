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
  TURMA_MIN: 3,
  TURMA_MAX: 100,
  MATRICULA_MIN: 6,
  MATRICULA_MAX: 15,
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

// Senha NÃO leva trim: espaço é caractere de senha como qualquer outro, e
// cortá-lo aqui faria o front validar uma senha diferente da que é enviada.
/** Mínimo de 8 caracteres, com pelo menos uma letra e um número. */
export function validarSenha(valor: unknown): Validacao {
  const senha = String(valor ?? '');
  if (senha.length === 0) return 'Informe uma senha.';
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

/** Campo de senha do login: só não pode estar vazio. */
export function validarSenhaLogin(valor: unknown): Validacao {
  return String(valor ?? '').length === 0 ? 'Informe a senha.' : null;
}

/** Matrícula do aluno: é o ID da tabela Alunos, entregue pelo professor. */
export function validarMatricula(valor: unknown): Validacao {
  return String(valor ?? '').trim().length === 0 ? 'Informe a matrícula.' : null;
}

// --- Matrícula (cadastro pelo professor) -----------------------------------
// No LOGIN a matrícula só precisa não estar vazia (validarMatricula acima):
// o aluno digita o que recebeu, e quem confere é o back. Aqui é o professor
// CRIANDO a matrícula, então vale a regra do formato: só dígitos, 6 a 15.

const SO_DIGITOS = /^\d+$/;

/** Matrícula nova: obrigatória, só dígitos, 6 a 15 caracteres. */
export function validarMatriculaNova(valor: unknown): Validacao {
  const matricula = String(valor ?? '').trim();
  if (matricula.length === 0) return 'Informe a matrícula.';
  if (!SO_DIGITOS.test(matricula)) return 'A matrícula tem só números.';
  if (matricula.length < LIMITES.MATRICULA_MIN || matricula.length > LIMITES.MATRICULA_MAX) {
    return `A matrícula tem de ${LIMITES.MATRICULA_MIN} a ${LIMITES.MATRICULA_MAX} dígitos.`;
  }
  return null;
}

/** Nome do aluno: OPCIONAL (a coluna Nome de Alunos aceita nulo). Vazio é
 *  válido; preenchido, 2 a 150 caracteres, sem contar espaço nas pontas. */
export function validarNomeAluno(valor: unknown): Validacao {
  const nome = String(valor ?? '').trim();
  if (nome.length === 0) return null;
  if (nome.length < LIMITES.NOME_MIN) return 'O nome precisa de pelo menos 2 caracteres.';
  if (nome.length > LIMITES.NOME_MAX) return 'O nome pode ter no máximo 150 caracteres.';
  return null;
}

/** O nome como vai no corpo: aparado, e null quando vazio — nunca "". */
export function nomeAlunoOuNull(valor: unknown): string | null {
  return String(valor ?? '').trim() || null;
}
