// token.ts
// O que vai dentro do token de login (JWT) e como ele é assinado. Usado
// pelos dois lados: o login, que emite o token, e o guard, que o confere.

// Quem entrou e por qual tabela. "conta" é a tabela Users (entra por
// e-mail); "aluno" é a tabela Alunos (entra pelo RP). É do token que toda
// rota tira a identidade: nenhuma confia em id mandado pela tela.
export type TipoDeLogin = 'conta' | 'aluno';

// O conteúdo do token. "sub" (subject) é o nome padrão do JWT para "de
// quem é este token"; aqui é o Users.ID ou o RP.
export interface ConteudoDoToken {
  sub: string;
  tipo: TipoDeLogin;
}

// A identidade que o guard entrega às rotas, já com nomes nossos.
export interface Identidade {
  id: string;
  tipo: TipoDeLogin;
}

// Quanto tempo o token vale. Oito horas cobrem um turno de aula inteiro sem
// pedir login de novo; depois disso, a tela recebe 401 e volta ao login.
export const VALIDADE_DO_TOKEN = '8h';

// O segredo vem do .env e nunca do código: quem tiver o segredo consegue
// assinar um token dizendo ser qualquer pessoa. Sem ele o back nem sobe —
// melhor do que subir assinando com "undefined".
export function segredoDoJwt(): string {
  const segredo = process.env.JWT_SEGREDO;
  if (!segredo) {
    throw new Error('JWT_SEGREDO não definido no .env. Veja o .env.example.');
  }
  return segredo;
}
