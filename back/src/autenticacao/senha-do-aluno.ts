// senha-do-aluno.ts
// A regra da senha de ALUNO, que o login confere no primeiro acesso (quando
// Alunos.SenhaHash é NULL e a senha enviada vai ser gravada).
//
// Quem digita é criança: de 4 a 20 caracteres, qualquer coisa serve, sem
// exigir letra, número nem símbolo. A senha de CONTA (Users) tem outra
// regra, mais forte, e não passa por aqui.
//
// A mesma regra existe no front, em js/utils/validacao.ts
// (validarSenhaAluno), com as mesmas mensagens. Está repetida porque o back
// não importa código do front; se uma mudar, a outra muda junto.

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
