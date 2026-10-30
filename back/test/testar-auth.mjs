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
//   Senhas erradas no login: 5 no mesmo minuto, para o mesmo e-mail (ou a
//     mesma turma + nome), e a 6ª tentativa dá 429 MUITAS_TENTATIVAS, até
//     com a senha certa; outro e-mail, ou um colega da mesma turma, do
//     mesmo IP, entra; login certo zera a contagem e não gasta tentativa.
//     As outras rotas ficam no limite geral (X-RateLimit-Limit: 1000).
//   Helmet: cabeçalhos de segurança na API e o Swagger (/api/docs) ainda
//     servindo a página e os arquivos dela.
//   JWT_SEGREDO: sem ele no ambiente, o back não sobe.
//
// Como rodar (em back/):
//   1. npm run seed                          (dados de teste: prof@teclar.dev, K7M2QX...)
//   2. npm run build && npm run start:prod   (em outro terminal)
//   3. npm run test:auth
//
// O caso do 429 bloqueia por 1 minuto só identidades que nenhum outro
// script usa (a conta criada aqui e o Caio Ferreira da turma-1). Rodar
// este script duas vezes no mesmo minuto falha no Caio.
//
// Usa o JWT_SEGREDO do back/.env para forjar os tokens vencido e de conta
// inexistente — por isso roda aqui, ao lado do back, e não no front.
//
// Grava no banco: cada execução cria uma conta teste-<horário>@teclar.dev.
// O npm run seed apaga todas.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { JwtService } from '@nestjs/jwt';

const URL = 'http://localhost:3000/api/auth';

// Faz a requisição e devolve status, corpo já lido como JSON e o texto
// cru (o texto é o que prova que o 204 veio vazio).
// headers vai junto para os casos do limite e do helmet.
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
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, texto, headers: resposta.headers };
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

// ============================================================================
// Senhas erradas no login (tentativas-de-login.ts) e limite geral
// ============================================================================

// O contador é por IP + quem tenta entrar, e só a senha errada conta.
async function errarSenha(vezes, corpo, nome) {
  for (let tentativa = 1; tentativa <= vezes; tentativa++) {
    const resposta = await chamar('POST', '/login', corpo);
    confere(`login (${nome}): ${tentativa}ª senha errada 401 CREDENCIAIS`, resposta.status === 401 && resposta.corpo.codigo === 'CREDENCIAIS');
  }
}

// Conta: a criada no começo deste script (senha abc12345), que nenhum
// outro script usa.
await errarSenha(5, { email, senha: 'errada123' }, 'conta');
r = await chamar('POST', '/login', { email: ` ${email.toUpperCase()} `, senha: 'abc12345' });
confere(
  `login (conta): 6ª tentativa, mesmo com a senha certa e o e-mail escrito de outro jeito, 429 MUITAS_TENTATIVAS (${r.corpo?.mensagem})`,
  r.status === 429 && r.corpo.codigo === 'MUITAS_TENTATIVAS' && typeof r.corpo.mensagem === 'string',
);

r = await chamar('POST', '/login', { email: 'prof@teclar.dev', senha: 'senha123' });
confere('login (conta): outro e-mail do mesmo IP, logo depois, entra (200)', r.status === 200);

// Aluno: mesma turma, nomes diferentes — a turma inteira sai pelo mesmo IP
// da escola, e o bloqueio de um não pode travar os colegas.
await errarSenha(5, { codigo: 'K7M2QX', nome: 'Caio Ferreira', senha: 'errada123' }, 'aluno');
r = await chamar('POST', '/login', { codigo: 'k7m2qx', nome: 'caio  ferreira', senha: 'aluno2026' });
confere('login (aluno): 6ª tentativa, mesmo com a senha certa, 429 MUITAS_TENTATIVAS', r.status === 429 && r.corpo.codigo === 'MUITAS_TENTATIVAS');

r = await chamar('POST', '/login', { codigo: 'K7M2QX', nome: 'Marina Duarte Alves', senha: 'aluno2026' });
confere('login (aluno): colega da mesma turma, do mesmo IP, entra (200)', r.status === 200);

// Login certo zera: 4 erradas + 1 certa, e mais 4 erradas não bloqueiam
// (sem zerar, seriam 8 falhas no minuto).
await errarSenha(4, { email: 'leo@teclar.dev', senha: 'errada123' }, 'zerar');
r = await chamar('POST', '/login', { email: 'leo@teclar.dev', senha: 'senha123' });
confere('login (zerar): 4 erradas + a certa 200', r.status === 200);
await errarSenha(4, { email: 'leo@teclar.dev', senha: 'errada123' }, 'zerar de novo');
r = await chamar('POST', '/login', { email: 'leo@teclar.dev', senha: 'senha123' });
confere('login (zerar): depois de mais 4 erradas, a certa ainda entra (200)', r.status === 200);

// Login certo não gasta tentativa: o professor que entra e sai várias vezes.
const status = [];
for (let vez = 1; vez <= 10; vez++) {
  status.push((await chamar('POST', '/login', { email: 'prof@teclar.dev', senha: 'senha123' })).status);
}
confere(`login: 10 logins certos seguidos na mesma conta, todos 200 (${status.join(' ')})`, status.every((s) => s === 200));

// As outras rotas ficam no limite geral do @nestjs/throttler, por IP.
r = await chamar('POST', '/logout');
confere('limite geral: 1000/min por IP (X-RateLimit-Limit)', r.status === 204 && r.headers.get('x-ratelimit-limit') === '1000');

// ============================================================================
// Helmet (cabeçalhos de segurança)
// ============================================================================

confere('helmet: X-Content-Type-Options nosniff', r.headers.get('x-content-type-options') === 'nosniff');
confere('helmet: Content-Security-Policy presente', r.headers.has('content-security-policy'));
confere('helmet: sem X-Powered-By (não anuncia o Express)', !r.headers.has('x-powered-by'));
// O back é só HTTP: o upgrade-insecure-requests quebraria o Swagger aberto pelo IP da rede.
confere(
  'helmet: CSP sem upgrade-insecure-requests',
  !r.headers.get('content-security-policy').includes('upgrade-insecure-requests'),
);

// O Swagger só funciona se a página e os scripts dela vierem do próprio
// back (o CSP só libera script-src 'self').
const docs = await fetch('http://localhost:3000/api/docs');
const htmlDocs = await docs.text();
confere('swagger: /api/docs 200 com CSP', docs.status === 200 && docs.headers.has('content-security-policy'));
confere('swagger: nenhum <script> inline (o CSP barraria)', !/<script>/.test(htmlDocs));
for (const arquivo of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-ui-init.js']) {
  const resposta = await fetch(`http://localhost:3000/api/docs/${arquivo}`);
  confere(`swagger: ${arquivo} 200`, resposta.status === 200);
}

// ============================================================================
// JWT_SEGREDO obrigatório
// ============================================================================

// Sobe outro back com JWT_SEGREDO vazio (o dotenv não sobrescreve o que já
// está no ambiente). Tem de cair na montagem do AutenticacaoModule, antes
// de abrir a porta — por isso confere a mensagem, e não só o código de
// saída (um EADDRINUSE na porta 3000 também sairia com erro).
const semSegredo = spawnSync(process.execPath, ['dist/main.js'], {
  env: { ...process.env, JWT_SEGREDO: '' },
  encoding: 'utf8',
  timeout: 30_000,
});
confere(
  'jwt: sem JWT_SEGREDO o back não sobe',
  semSegredo.status !== 0 && (semSegredo.stdout + semSegredo.stderr).includes('JWT_SEGREDO não definido'),
);

console.log(`\nTudo certo. Conta de teste criada: ${email}`);
