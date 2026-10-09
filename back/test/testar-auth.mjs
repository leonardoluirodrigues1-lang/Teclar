// testar-auth.mjs
// Teste de fumaça das quatro rotas de /auth, feito por HTTP (fetch) contra
// o back rodando, sem navegador. Cobre:
//   POST /auth/cadastro — 200 com token e usuário no formato do login, nome
//     e e-mail normalizados, sem campanhaAtiva; a conta nova entra pelo
//     login; e-mail repetido 409 EMAIL_EM_USO; senha, e-mail e nome fora
//     da regra 400 DADOS_INVALIDOS.
//   GET /auth/eu — o GuardaDoToken: sem token, token que não é JWT,
//     assinatura errada, token vencido e conta inexistente dão 401
//     TOKEN_INVALIDO; token de conta e de aluno devolvem exatamente o
//     `usuario` do login de cada um.
//   POST /auth/logout — 204 sem corpo, com e sem token.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:auth
//
// Usa o JWT_SEGREDO do back/.env para forjar os tokens vencido e de conta
// inexistente — por isso roda aqui, ao lado do back, e não no front.
//
// Grava no banco: cada execução cria uma conta teste-<horário>@teclar.dev.
// O npm run seed apaga todas.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { JwtService } from '@nestjs/jwt';

const URL = 'http://localhost:3000/api/auth';

// Faz a requisição e devolve status, corpo já lido como JSON e o texto
// cru (o texto é o que prova que o 204 veio vazio).
async function chamar(metodo, rota, corpo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const opcoes = { method: metodo, headers };
  // GET não pode levar body (o fetch recusa), então só põe quando há corpo.
  if (corpo) {
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(URL + rota, opcoes);
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, texto };
}

// Para no primeiro caso que falhar, com o nome dele.
function confere(nome, condicao) {
  assert.ok(condicao, nome);
  console.log('ok -', nome);
}

// Token assinado com o segredo do back, com o conteúdo que o caso precisa.
function tokenForjado(conteudo) {
  return new JwtService({ secret: process.env.JWT_SEGREDO }).sign(conteudo);
}

// E-mail novo a cada execução: o teste roda de novo sem bater no 409.
const email = `teste-${Date.now()}@teclar.dev`;

// ============================================================================
// POST /auth/cadastro
// ============================================================================

// Nome com espaços sobrando e e-mail em maiúscula com espaço nas pontas:
// o back tem de gravar os dois normalizados.
let r = await chamar('POST', '/cadastro', {
  nome: '  Teste  Silva ',
  email: ` ${email.toUpperCase()} `,
  senha: 'abc12345',
});
confere('cadastro: 200', r.status === 200);
confere('cadastro: devolve token', typeof r.corpo.token === 'string');
confere(
  'cadastro: usuario no formato do login, normalizado e sem campanhaAtiva',
  r.corpo.usuario.tipo === 'conta' &&
    r.corpo.usuario.email === email &&
    r.corpo.usuario.nome === 'Teste Silva' &&
    !('campanhaAtiva' in r.corpo.usuario),
);
const tokenDoCadastro = r.corpo.token;

r = await chamar('POST', '/login', { email, senha: 'abc12345' });
confere('cadastro: a conta nova entra pelo login', r.status === 200);

r = await chamar('POST', '/cadastro', { nome: 'Outro', email, senha: 'abc12345' });
confere('cadastro: e-mail repetido 409 EMAIL_EM_USO', r.status === 409 && r.corpo.codigo === 'EMAIL_EM_USO');

// Cada senha quebra uma parte da regra de conta.
for (const senha of [' abc12345', 'abc12345 ', 'abc123', 'abcdefgh', '12345678', '']) {
  r = await chamar('POST', '/cadastro', { nome: 'X Y', email: `outro-${Date.now()}@teclar.dev`, senha });
  confere(
    `cadastro: senha ${JSON.stringify(senha)} 400 (${r.corpo?.mensagem})`,
    r.status === 400 && r.corpo.codigo === 'DADOS_INVALIDOS',
  );
}

r = await chamar('POST', '/cadastro', { nome: 'X Y', email: 'sem-arroba', senha: 'abc12345' });
confere('cadastro: e-mail inválido 400', r.status === 400 && r.corpo.codigo === 'DADOS_INVALIDOS');

r = await chamar('POST', '/cadastro', { nome: 'X', email: `x-${Date.now()}@teclar.dev`, senha: 'abc12345' });
confere('cadastro: nome de 1 caractere 400', r.status === 400 && r.corpo.codigo === 'DADOS_INVALIDOS');

// ============================================================================
// GET /auth/eu (o GuardaDoToken)
// ============================================================================

function ehTokenInvalido(resposta) {
  return resposta.status === 401 && resposta.corpo.codigo === 'TOKEN_INVALIDO';
}

r = await chamar('GET', '/eu');
confere('eu: sem token 401 TOKEN_INVALIDO', ehTokenInvalido(r));

r = await chamar('GET', '/eu', null, 'lixo.que.nao-e-jwt');
confere('eu: token que não é JWT 401', ehTokenInvalido(r));

r = await chamar('GET', '/eu', null, new JwtService({ secret: 'segredo-errado' }).sign({ sub: 'u-2', tipo: 'conta' }));
confere('eu: assinatura errada 401', ehTokenInvalido(r));

// exp no passado: venceu há um minuto.
r = await chamar('GET', '/eu', null, tokenForjado({ sub: 'u-2', tipo: 'conta', exp: Math.floor(Date.now() / 1000) - 60 }));
confere('eu: token vencido 401', ehTokenInvalido(r));

r = await chamar('GET', '/eu', null, tokenForjado({ sub: 'nao-existe', tipo: 'conta' }));
confere('eu: token válido de conta inexistente 401', ehTokenInvalido(r));

r = await chamar('GET', '/eu', null, tokenDoCadastro);
confere('eu: token do cadastro devolve a conta nova', r.status === 200 && r.corpo.email === email);

// O /eu tem de devolver EXATAMENTE o usuario que o login devolveu.
const loginConta = await chamar('POST', '/login', { email: 'prof@teclar.dev', senha: 'senha123' });
r = await chamar('GET', '/eu', null, loginConta.corpo.token);
confere(
  'eu: token de conta = usuario do login (com campanhaAtiva)',
  r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify(loginConta.corpo.usuario),
);

const loginAluno = await chamar('POST', '/login', { codigo: 'K7M2QX', nome: 'Ana Pires', senha: 'aluno2026' });
confere('eu: login do aluno de teste', loginAluno.status === 200);
r = await chamar('GET', '/eu', null, loginAluno.corpo.token);
confere(
  'eu: token de aluno = usuario do login (com turmas)',
  r.status === 200 && JSON.stringify(r.corpo) === JSON.stringify(loginAluno.corpo.usuario),
);

// ============================================================================
// POST /auth/logout
// ============================================================================

r = await chamar('POST', '/logout');
confere('logout: sem token 204 sem corpo', r.status === 204 && r.texto === '');

r = await chamar('POST', '/logout', null, loginConta.corpo.token);
confere('logout: com token 204 sem corpo', r.status === 204 && r.texto === '');

console.log(`\nTudo certo. Conta de teste criada: ${email}`);
