// A regra da senha de ALUNO, conferida quando ele cria a senha dele
// (POST /aluno/senha, depois de entrar com a senha provisória).
//
// Quem digita é criança: de 4 a 20 caracteres, qualquer coisa serve, sem
// exigir letra, número nem símbolo. A senha de CONTA (Users) tem outra
// regra, mais forte, e não passa por aqui.
//
// A mesma regra existe no front, em js/utils/validacao.ts
// (validarSenhaAluno), com as mesmas mensagens. Está repetida porque o back
// não importa código do front; se uma mudar, a outra muda junto.

import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const SENHA_DO_ALUNO_MINIMO = 4;
export const SENHA_DO_ALUNO_MAXIMO = 20;

// Devolve null quando a senha serve, e a mensagem pronta quando não serve.
// A senha chega já aparada nas pontas (o login apara antes de tudo), então
// o tamanho contado aqui é o da senha que vai ser gravada.
export function problemaNaSenhaDoAluno(senha: string): string | null {
  const faltam = SENHA_DO_ALUNO_MINIMO - senha.length;
  if (faltam === 1) {
    return 'Falta 1 caractere.';
  }
  if (faltam > 1) {
    return `Faltam ${faltam} caracteres.`;
  }
  if (senha.length > SENHA_DO_ALUNO_MAXIMO) {
    return `A senha pode ter no máximo ${SENHA_DO_ALUNO_MAXIMO} caracteres.`;
  }
  return null;
}

// --- Senha provisória ---------------------------------------------------------
// O professor gera (na importação ou pelo botão da turma) e entrega ao
// aluno no papel. Ela abre UM login (o login apaga o hash) e vale por
// VALIDADE_DA_PROVISORIA_DIAS; depois o aluno cria a dele em POST /aluno/senha.

export const VALIDADE_DA_PROVISORIA_DIAS = 7;
export const CUSTO_BCRYPT_ALUNO = 10;

// Sem 0/o, 1/l/i: a criança copia do papel e não pode confundir.
const LETRAS_DA_PROVISORIA = 'abcdefghjkmnpqrstuvwxyz23456789';
const TAMANHO_DA_PROVISORIA = 6;

export interface SenhaProvisoria {
  senha: string;
  hash: string;
  expira: Date;
}

export async function gerarSenhaProvisoria(agora = new Date()): Promise<SenhaProvisoria> {
  let senha = '';
  for (let i = 0; i < TAMANHO_DA_PROVISORIA; i++) {
    senha += LETRAS_DA_PROVISORIA[randomInt(LETRAS_DA_PROVISORIA.length)];
  }
  // Segundos inteiros: a coluna é TIMESTAMP(0), e a resposta tem de bater com o gravado.
  const expira = new Date(Math.floor(agora.getTime() / 1000) * 1000 + VALIDADE_DA_PROVISORIA_DIAS * 24 * 60 * 60 * 1000);
  return { senha, hash: await bcrypt.hash(senha, CUSTO_BCRYPT_ALUNO), expira };
}

// A provisória ainda abre o login? Só com hash e dentro da validade.
export function provisoriaValida(hash: string | null, expira: Date | null, agora = new Date()): boolean {
  return hash !== null && expira !== null && expira.getTime() > agora.getTime();
}
