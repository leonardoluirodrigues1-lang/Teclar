// testar-telas.mjs
// Teste das telas com Playwright: clica, digita e confere cada cenário de
// TESTE-TELAS.md num Chromium de verdade, como a pessoa faria. Serve para
// rodar de novo antes da apresentação e pegar o que quebrou de lá para cá.
//
// Como rodar (na pasta teclar/):
//   1. back no ar na 3000 (em back/: npm run build && npm run start:prod)
//   2. live-server servindo teclar/ na 5500 (npx live-server --port=5500 --no-browser)
//   3. npm run test:telas
//
// O script roda `npm run seed` no começo (dados conhecidos para conferir) e
// no fim (o banco volta limpo para a demonstração, sem as turmas e contas
// que o teste criou).
//
// Em todo cenário: erro no console do navegador é falha, e resposta 4xx/5xx
// que o cenário não declarou como prevista também. Falhou, vai um print para
// testes-telas/falhas/<cenario>.png.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PASTA = path.dirname(fileURLToPath(import.meta.url));
const PASTA_FALHAS = path.join(PASTA, 'falhas');
const PASTA_BACK = path.join(PASTA, '..', 'back');

const SITE = 'http://localhost:5500';
const BACK = 'http://localhost:3000/api';

const PROFESSOR = { email: 'prof@teclar.dev', senha: 'senha123' };
const ANA = { codigo: 'R8VD3K', nome: 'Ana Pires', senha: 'aluno2026' };

// Marca única desta execução: nomes de turma, exercício, aluno e e-mail
// novos a cada vez, para o teste não tropeçar no que a rodada anterior criou.
const MARCA = String(Date.now()).slice(-6);

// O que um cenário cria e o seguinte usa (a turma nova, o código dela...).
const estado = {};

// ============================================================================
// Cenários — na ordem de TESTE-TELAS.md
// ============================================================================
// Cada um: id, nome, as respostas de erro previstas ([status, pedaço da
// URL]) e a função que clica. A função recebe a página já aberta num
// navegador limpo (sem sessão) e lança erro quando algo não confere.

const cenarios = [
  // --- Login e modo ---------------------------------------------------------
  {
    id: 'L1',
    nome: 'Login com senha errada',
    previstos: [[401, '/auth/login']],
    async rodar(page) {
      await abrir(page, '/pages/login.html');
      await page.fill('#campo-email', PROFESSOR.email);
      await page.fill('#campo-senha', 'errada123');
      await page.click('#btn-entrar-conta');
      await esperarTextoEm(page, '#erro-conta', /./);
      confere(page.url().includes('/pages/login.html'), 'saiu da tela de login');
      confere((await page.inputValue('#campo-senha')) === '', 'a senha errada continuou no campo');
    },
  },
  {
    id: 'L2',
    nome: 'Login com e-mail sem formato',
    async rodar(page) {
      let requisicoes = 0;
      page.on('request', (r) => r.url().startsWith(BACK) && requisicoes++);
      await abrir(page, '/pages/login.html');
      await page.fill('#campo-email', 'prof@');
      await page.fill('#campo-senha', 'senha123');
      await page.click('#btn-entrar-conta');
      await esperarTextoEm(page, '#erro-email', /./);
      confere(requisicoes === 0, 'mandou requisição com o e-mail inválido');
    },
  },
  {
    id: 'L3',
    nome: 'Login com senha certa leva à escolha de modo',
    async rodar(page) {
      await entrarComConta(page, PROFESSOR);
      await page.getByText('Olá, Henrique').waitFor();
    },
  },
  {
    id: 'L4',
    nome: 'Escolher Professor leva às turmas',
    async rodar(page) {
      await entrarComConta(page, PROFESSOR);
      await page.click('a[data-modo="professor"]');
      await page.waitForURL('**/pages/professor/turmas.html');
      await page.locator('#suas-turmas').waitFor();
    },
  },
  {
    id: 'L5',
    nome: 'Aluno com código errado',
    previstos: [[401, '/auth/login']],
    async rodar(page) {
      await abrir(page, '/pages/login.html?aluno=1');
      await page.fill('#campo-codigo', 'ZZZZZZ');
      await page.fill('#campo-nome-aluno', ANA.nome);
      await page.fill('#campo-senha-aluno', ANA.senha);
      await page.click('#btn-entrar-aluno');
      await esperarTextoEm(page, '#erro-aluno', /./);
      confere(page.url().includes('/pages/login.html'), 'saiu da tela de login');
    },
  },

  // --- Professor ------------------------------------------------------------
  {
    id: 'P1',
    nome: 'Listar turmas',
    async rodar(page) {
      await entrarComoProfessor(page);
      await page.getByText('9º Ano A — Manhã').first().waitFor();
      await page.getByText('Reforço de digitação').first().waitFor();
    },
  },
  {
    id: 'P2',
    nome: 'Criar turma',
    async rodar(page) {
      await entrarComoProfessor(page);
      const nome = `Turma da Banca ${MARCA}`;
      await criarTurma(page, nome);
      await esperarToast(page, 'Turma criada');
      await page.getByRole('heading', { name: nome }).waitFor();
      estado.turma = await turmaPeloNome(page, nome);
    },
  },
  {
    id: 'P3',
    nome: 'Criar turma com nome repetido',
    previstos: [[409, '/turmas']],
    async rodar(page) {
      exigir('turma', 'P2');
      await entrarComoProfessor(page);
      await criarTurma(page, estado.turma.nome);
      const modal = page.getByRole('dialog');
      await esperarTextoEm(page, '[role="dialog"] .erro-campo', /./);
      confere(await modal.isVisible(), 'o modal fechou depois do conflito');
    },
  },
  {
    id: 'P4',
    nome: 'Arquivar, achar em "Mostrar arquivadas" e desarquivar',
    async rodar(page) {
      exigir('turma', 'P2');
      await entrarComoProfessor(page);
      const nome = estado.turma.nome;
      await page.getByRole('button', { name: `Opções da turma ${nome}` }).click();
      await page.getByRole('menuitem', { name: 'Arquivar turma' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Arquivar turma' }).click();
      await esperarToast(page, 'Turma arquivada');
      await page.getByRole('button', { name: /^Mostrar arquivadas/ }).click();
      await page.getByRole('button', { name: `Desarquivar a turma ${nome}` }).click();
      await esperarToast(page, 'Turma desarquivada');
      await page.locator('#conteudo').getByRole('heading', { name: nome }).waitFor();
    },
  },
  {
    id: 'P5',
    nome: 'Gerar código novo',
    async rodar(page) {
      exigir('turma', 'P2');
      await entrarComoProfessor(page);
      await abrir(page, `/pages/professor/turma.html?turma=${estado.turma.id}`);
      const antigo = estado.turma.codigo;
      await page.locator('#metricas').getByText(antigo).waitFor();
      await page.getByRole('button', { name: 'Gerar novo' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Gerar código novo' }).click();
      await esperarToast(page, 'Código novo:');
      const novo = (await page.locator('#metricas .col-mono').textContent()).trim();
      confere(/^[A-Z2-9]{6}$/.test(novo) && novo !== antigo, `o código do painel não mudou (${novo})`);
      estado.turma.codigo = novo;
    },
  },
  {
    id: 'P6',
    nome: 'Importar nomes por CSV (adicionados, já estavam, falhas)',
    async rodar(page) {
      exigir('turma', 'P2');
      await entrarComoProfessor(page);
      await abrir(page, `/pages/professor/alunos.html?turma=${estado.turma.id}`);
      await page.click('#aba-csv');
      // Primeira planilha: dois nomes que ainda não estão na turma.
      await importarCsv(page, ['nome', 'Aluno Teste Um', 'Aluno Teste Dois']);
      await page.locator('#resultado').getByText('Adicionados').first().waitFor();
      // Segunda: um que já está, um novo e um curto demais.
      await page.getByRole('button', { name: 'Importar outro arquivo' }).click();
      await importarCsv(page, ['nome', 'Aluno Teste Um', 'Aluno Teste Tres', 'X']);
      const resultado = page.locator('#resultado');
      // first(): cada grupo tem o título e o texto de ajuda com a palavra.
      await resultado.getByText('Adicionados').first().waitFor();
      await resultado.getByText('Já estavam').first().waitFor();
      await resultado.getByText('Falharam').first().waitFor();
      estado.alunos = ['Aluno Teste Um', 'Aluno Teste Dois', 'Aluno Teste Tres'];
    },
  },
  {
    id: 'P7',
    nome: 'Remover aluno da turma',
    async rodar(page) {
      exigir('alunos', 'P6');
      await abrirTurma(page, 'Participantes');
      await page.getByRole('button', { name: 'Remover Aluno Teste Dois da turma' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Remover da turma' }).click();
      await esperarToast(page, 'Aluno removido da turma');
      await page.getByRole('button', { name: 'Remover Aluno Teste Dois da turma' }).waitFor({ state: 'detached' });
    },
  },
  {
    id: 'P8',
    nome: 'Atribuir exercício',
    async rodar(page) {
      exigir('turma', 'P2');
      await abrirTurma(page, 'Exercícios');
      await page.click('#btn-atribuir');
      const modal = page.getByRole('dialog');
      await modal.locator('label', { hasText: 'Frase curta' }).locator('input').check();
      await modal.getByRole('button', { name: 'Atribuir selecionados' }).click();
      await esperarToast(page, 'Exercício atribuído');
      await page.locator('#conteudo').getByText('Frase curta').first().waitFor();
    },
  },
  {
    id: 'B1',
    nome: 'Biblioteca: exercício com texto curto',
    async rodar(page) {
      await abrirBiblioteca(page);
      await page.click('#btn-novo');
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Título').fill(`Curto ${MARCA}`);
      await modal.getByLabel('Texto do exercício').fill('pouco texto');
      await modal.getByRole('button', { name: 'Criar exercício' }).click();
      await esperarTextoEm(page, '[role="dialog"] .erro-campo', /./);
      confere(await modal.isVisible(), 'o modal fechou com o texto inválido');
    },
  },
  {
    id: 'B2',
    nome: 'Biblioteca: criar exercício',
    async rodar(page) {
      await abrirBiblioteca(page);
      const titulo = `Exercício da Banca ${MARCA}`;
      await page.click('#btn-novo');
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Título').fill(titulo);
      await modal.getByLabel('Texto do exercício').fill('A banca digita devagar para conferir cada letra.');
      await modal.getByRole('button', { name: 'Criar exercício' }).click();
      await esperarToast(page, 'Exercício criado');
      await page.locator('#conteudo').getByText(titulo).waitFor();
      estado.exercicio = titulo;
    },
  },
  {
    id: 'B3',
    nome: 'Biblioteca: editar exercício',
    async rodar(page) {
      exigir('exercicio', 'B2');
      await abrirBiblioteca(page);
      const novo = `${estado.exercicio} editado`;
      await page.getByRole('button', { name: `Editar "${estado.exercicio}"` }).click();
      await page.getByRole('dialog').getByLabel('Título').fill(novo);
      await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
      await esperarToast(page, 'Exercício atualizado');
      await page.locator('#conteudo').getByText(novo).waitFor();
      estado.exercicio = novo;
    },
  },
  {
    id: 'B4',
    nome: 'Biblioteca: arquivar exercício',
    async rodar(page) {
      exigir('exercicio', 'B2');
      await abrirBiblioteca(page);
      await page.getByRole('button', { name: `Arquivar "${estado.exercicio}"` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click();
      await esperarToast(page, 'Exercício arquivado');
      await page.locator('#conteudo').getByText(estado.exercicio).waitFor({ state: 'detached' });
    },
  },
  {
    id: 'R1',
    nome: 'Relatório com "—" para quem nunca treinou',
    async rodar(page) {
      await abrirRelatorioDaTurma2(page);
      const linha = page.locator('tr', { hasText: 'Helena Rocha' });
      await linha.waitFor();
      confere((await linha.textContent()).includes('—'), 'a linha da Helena não tem "—"');
    },
  },
  {
    id: 'R2',
    nome: 'Relatório: modal com as sessões do aluno',
    async rodar(page) {
      await abrirRelatorioDaTurma2(page);
      await page.getByRole('button', { name: 'Ver histórico de Bruno Sato nesta turma' }).click();
      const modal = page.getByRole('dialog');
      await modal.getByText('Histórico do aluno').waitFor();
      await modal.getByText('Concluiu').first().waitFor();
    },
  },

  // --- Aluno (Ana, turma-2) -------------------------------------------------
  {
    id: 'A1',
    nome: 'Aluno: dashboard com a sala',
    async rodar(page) {
      await entrarComoAluno(page, ANA);
      await page.getByText('Reforço de digitação').first().waitFor();
    },
  },
  {
    id: 'A2',
    nome: 'Aluno: sala com os exercícios',
    async rodar(page) {
      await entrarComoAluno(page, ANA);
      await abrirSalaDaAna(page);
      await page.getByRole('link', { name: /Funções em JavaScript/ }).waitFor();
      await page.getByRole('link', { name: /Frase curta/ }).waitFor();
    },
  },
  {
    id: 'A3',
    nome: 'Aluno: digitar o exercício inteiro',
    async rodar(page) {
      await entrarComoAluno(page, ANA);
      await abrirSalaDaAna(page);
      await page.getByRole('link', { name: /Funções em JavaScript/ }).click();
      await page.waitForURL('**/pages/treino/treino.html**');
      await digitarTextoDoTreino(page);
      const modal = page.getByRole('dialog');
      await modal.getByText('Lição enviada ao professor!').waitFor();
      estado.ppmDaAna = await numeroDaMetrica(modal, 'PPM');
    },
  },
  {
    id: 'A4',
    nome: 'Aluno: histórico com a sessão nova no topo',
    async rodar(page) {
      exigir('ppmDaAna', 'A3');
      await entrarComoAluno(page, ANA);
      await abrir(page, '/pages/aluno/historico.html');
      const primeira = page.locator('tbody tr').first();
      await primeira.waitFor();
      const texto = await primeira.textContent();
      confere(texto.includes('Funções em JavaScript'), `a primeira linha não é a sessão nova: ${texto}`);
      confere(texto.includes(String(estado.ppmDaAna)), `o PPM da sessão nova (${estado.ppmDaAna}) não está na primeira linha: ${texto}`);
    },
  },
  {
    id: 'A5',
    nome: 'Aluno: ranking com a Ana marcada',
    async rodar(page) {
      await entrarComoAluno(page, ANA);
      await abrirSalaDaAna(page);
      await page.getByRole('tab', { name: 'Participantes' }).click();
      const dela = page.locator('tr.linha-voce');
      await dela.waitFor();
      confere((await dela.textContent()).includes('você'), 'a linha da Ana não tem a marca "você"');
      const primeira = await page.locator('tbody tr').first().textContent();
      confere(primeira.includes('Bruno Sato') && primeira.includes('146'), `o 1º lugar não é o Bruno com 146: ${primeira}`);
    },
  },

  // --- Primeiro acesso ------------------------------------------------------
  {
    id: 'PA1',
    nome: 'Primeiro acesso com senha curta demais',
    async rodar(page) {
      exigir('alunos', 'P6');
      await abrir(page, '/pages/login.html?aluno=1');
      await preencherLoginDeAluno(page, { codigo: estado.turma.codigo, nome: 'Aluno Teste Um', senha: 'abc' });
      await esperarTextoEm(page, '#erro-senha-aluno', /./);
      confere(page.url().includes('/pages/login.html'), 'saiu da tela de login');
    },
  },
  {
    id: 'PA2',
    nome: 'Primeiro acesso com senha nova',
    async rodar(page) {
      exigir('alunos', 'P6');
      await entrarPelaPrimeiraVez(page, { codigo: estado.turma.codigo, nome: 'Aluno Teste Um', senha: 'primeira1' });
      await page.getByText(estado.turma.nome).first().waitFor();
    },
  },
  {
    id: 'PA2b',
    nome: 'Segundo login com a mesma senha não mostra o aviso',
    async rodar(page) {
      exigir('alunos', 'P6');
      await abrir(page, '/pages/login.html?aluno=1');
      await preencherLoginDeAluno(page, { codigo: estado.turma.codigo, nome: 'Aluno Teste Um', senha: 'primeira1' });
      await page.waitForURL('**/pages/aluno/dashboard.html');
    },
  },
  {
    id: 'PA3',
    nome: 'Professor zera a senha do aluno',
    async rodar(page) {
      exigir('alunos', 'P6');
      await abrirTurma(page, 'Participantes');
      await page.getByRole('button', { name: 'Zerar a senha de Aluno Teste Um' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Zerar senha' }).click();
      await esperarToast(page, 'Senha zerada');
    },
  },
  {
    id: 'PA4',
    nome: 'Aluno entra com outra senha nova depois de zerada',
    async rodar(page) {
      exigir('alunos', 'P6');
      // Senha zerada é primeiro acesso de novo: o aviso volta.
      await entrarPelaPrimeiraVez(page, { codigo: estado.turma.codigo, nome: 'Aluno Teste Um', senha: 'segunda2' });
      await page.getByText(estado.turma.nome).first().waitFor();
    },
  },

  // --- Solo -----------------------------------------------------------------
  {
    id: 'S1',
    nome: 'Cadastro com confirmação diferente',
    async rodar(page) {
      await abrir(page, '/pages/cadastro.html');
      await preencherCadastro(page, { nome: 'Jogador da Banca', email: emailDoSolo(), senha: 'senha123', confirmacao: 'senha124' });
      await esperarTextoEm(page, '#erro-confirmacao', /./);
      confere(page.url().includes('/pages/cadastro.html'), 'saiu do cadastro');
    },
  },
  {
    id: 'S2',
    nome: 'Cadastro de conta nova',
    async rodar(page) {
      await abrir(page, '/pages/cadastro.html');
      await preencherCadastro(page, { nome: 'Jogador da Banca', email: emailDoSolo(), senha: 'senha123', confirmacao: 'senha123' });
      await page.waitForURL('**/pages/modo.html');
      estado.solo = { email: emailDoSolo(), senha: 'senha123' };
    },
  },
  {
    id: 'S3',
    nome: 'Começar a campanha',
    async rodar(page) {
      exigir('solo', 'S2');
      await entrarNoSolo(page);
      await page.getByRole('button', { name: 'Começar campanha' }).click();
      await page.waitForURL('**/pages/solo/caminho.html');
      // A primeira vez da conta no Solo abre o tutorial; quem tem pressa pula.
      await page.getByRole('button', { name: 'Pular' }).click();
      await page.locator('a.pedra').first().waitFor();
      estado.campanha = true;
    },
  },
  {
    id: 'S4',
    nome: 'Concluir uma lição e ganhar XP',
    async rodar(page) {
      exigir('campanha', 'S3');
      await entrarNoSolo(page);
      await page.waitForURL('**/pages/solo/caminho.html');
      await pularTutorialSeAparecer(page);
      await page.locator('a.pedra').first().click();
      await page.waitForURL('**/pages/treino/treino.html**');
      await digitarTextoDoTreino(page);
      await page.waitForURL('**/pages/treino/resultado.html**');
      await esperarTextoEm(page, '#titulo', /\+\d+ XP/);
      await esperarNumerosParados(page);
      estado.resultado = { url: page.url(), metricas: await metricasDoResultado(page) };
      estado.xp = Number((await page.textContent('#xp-total')).trim());
      confere(estado.xp > 0, 'o XP não subiu');
    },
  },
  {
    id: 'S5',
    nome: 'F5 no resultado mostra os mesmos números',
    async rodar(page) {
      exigir('resultado', 'S4');
      await entrarComConta(page, estado.solo);
      await abrir(page, estado.resultado.url.replace(SITE, ''));
      await page.locator('.bloco-metricas').waitFor();
      await esperarNumerosParados(page);
      const depois = await metricasDoResultado(page);
      confere(
        JSON.stringify(depois) === JSON.stringify(estado.resultado.metricas),
        `antes ${JSON.stringify(estado.resultado.metricas)}, depois do F5 ${JSON.stringify(depois)}`
      );
    },
  },
  {
    id: 'S6',
    nome: 'Estatísticas com a lição concluída',
    async rodar(page) {
      exigir('xp', 'S4');
      await entrarNoSolo(page);
      await abrir(page, '/pages/solo/estatisticas.html');
      await esperarTextoEm(page, '#metrica-licoes', /1/);
      await esperarTextoEm(page, '#metrica-xp', new RegExp(String(estado.xp)));
    },
  },
  {
    id: 'S7',
    nome: 'Cadastro com e-mail já usado',
    previstos: [[409, '/auth/cadastro']],
    async rodar(page) {
      exigir('solo', 'S2');
      await abrir(page, '/pages/cadastro.html');
      await preencherCadastro(page, { nome: 'Jogador da Banca', email: estado.solo.email, senha: 'senha123', confirmacao: 'senha123' });
      await esperarTextoEm(page, '#erro-form, #erro-email', /./);
      confere(page.url().includes('/pages/cadastro.html'), 'saiu do cadastro');
    },
  },

  // --- Sessão expirada ------------------------------------------------------
  {
    id: 'E1',
    nome: 'Token apagado: recarregar volta ao login',
    async rodar(page) {
      await entrarComoProfessor(page);
      await page.evaluate(() => sessionStorage.removeItem('teclar:token'));
      await page.reload();
      await page.waitForURL('**/pages/login.html**');
    },
  },
  {
    id: 'E2',
    nome: 'Token inválido: a primeira chamada volta ao login com aviso',
    previstos: [[401, '/turmas']],
    async rodar(page) {
      await entrarComoProfessor(page);
      await page.evaluate(() => sessionStorage.setItem('teclar:token', 'token-vencido'));
      await page.getByText('9º Ano A — Manhã').first().click();
      await page.waitForURL('**/pages/login.html?expirou=1');
      await page.getByText('Sua sessão expirou').waitFor();
    },
  },
];

// ============================================================================
// Passos que vários cenários repetem
// ============================================================================

async function abrir(page, caminho) {
  await page.goto(SITE + caminho);
}

async function entrarComConta(page, { email, senha }) {
  await abrir(page, '/pages/login.html');
  await page.fill('#campo-email', email);
  await page.fill('#campo-senha', senha);
  await page.click('#btn-entrar-conta');
  await page.waitForURL('**/pages/modo.html');
}

async function entrarComoProfessor(page) {
  await entrarComConta(page, PROFESSOR);
  await page.click('a[data-modo="professor"]');
  await page.waitForURL('**/pages/professor/turmas.html');
  await page.locator('#suas-turmas').waitFor();
}

async function entrarNoSolo(page) {
  await entrarComConta(page, estado.solo);
  await page.click('a[data-modo="solo"]');
  await page.waitForURL(/\/pages\/solo\/(caminho|dashboard)\.html/);
}

// A marca de "tutorial visto" mora no localStorage, e cada cenário abre
// um navegador limpo: o tutorial do Solo volta a aparecer, como num
// aparelho novo. Espera a trilha ou o tutorial, o que vier primeiro.
async function pularTutorialSeAparecer(page) {
  const pular = page.getByRole('button', { name: 'Pular' });
  await pular.or(page.locator('a.pedra').first()).waitFor();
  if (await pular.isVisible()) await pular.click();
}

async function preencherLoginDeAluno(page, { codigo, nome, senha }) {
  await page.fill('#campo-codigo', codigo);
  await page.fill('#campo-nome-aluno', nome);
  await page.fill('#campo-senha-aluno', senha);
  await page.click('#btn-entrar-aluno');
}

async function entrarComoAluno(page, aluno) {
  await abrir(page, '/pages/login.html?aluno=1');
  await preencherLoginDeAluno(page, aluno);
  await page.waitForURL('**/pages/aluno/dashboard.html');
}

// O primeiro acesso para no aviso "Essa é a sua senha agora", ainda na
// tela de login; só o "Continuar" leva ao dashboard.
async function entrarPelaPrimeiraVez(page, aluno) {
  await abrir(page, '/pages/login.html?aluno=1');
  await preencherLoginDeAluno(page, aluno);
  const aviso = page.getByRole('dialog');
  await aviso.getByText('Essa é a sua senha agora').waitFor();
  await aviso.getByText('Guarde bem.', { exact: false }).waitFor();
  confere(page.url().includes('/pages/login.html'), 'saiu do login antes do aviso');
  await aviso.getByRole('button', { name: 'Continuar' }).click();
  await page.waitForURL('**/pages/aluno/dashboard.html');
}

async function abrirSalaDaAna(page) {
  await page.getByRole('link', { name: /Reforço de digitação/ }).first().click();
  await page.waitForURL('**/pages/aluno/sala.html**');
}

async function abrirTurma(page, aba) {
  await entrarComoProfessor(page);
  await abrir(page, `/pages/professor/turma.html?turma=${estado.turma.id}`);
  await page.getByRole('tab', { name: aba }).click();
}

async function abrirBiblioteca(page) {
  await entrarComoProfessor(page);
  await abrir(page, '/pages/professor/biblioteca.html');
  await page.locator('#titulo').waitFor();
}

async function abrirRelatorioDaTurma2(page) {
  await entrarComoProfessor(page);
  await abrir(page, '/pages/professor/relatorios.html');
  await page.locator('#seletor-turma:not([disabled])').waitFor();
  await page.selectOption('#seletor-turma', { label: 'Reforço de digitação' });
}

async function criarTurma(page, nome) {
  await page.click('#btn-criar');
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Nome da turma').fill(nome);
  await modal.getByRole('button', { name: 'Criar turma' }).click();
}

// O id e o código da turma recém-criada saem do back, com o token da
// própria página: a tela não mostra o id em lugar nenhum.
async function turmaPeloNome(page, nome) {
  const turmas = await page.evaluate(async (base) => {
    const token = sessionStorage.getItem('teclar:token');
    const resposta = await fetch(`${base}/turmas`, { headers: { Authorization: `Bearer ${token}` } });
    return resposta.json();
  }, BACK);
  const turma = turmas.find((t) => t.nome === nome);
  confere(turma, `a turma "${nome}" não está no back`);
  return { id: turma.id, nome, codigo: turma.codigo };
}

async function importarCsv(page, linhas) {
  await page.setInputFiles('#campo-arquivo', {
    name: 'alunos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(linhas.join('\n'), 'utf-8'),
  });
  await page.click('#btn-importar');
}

async function preencherCadastro(page, { nome, email, senha, confirmacao }) {
  await page.fill('#campo-nome', nome);
  await page.fill('#campo-email', email);
  await page.fill('#campo-senha', senha);
  await page.fill('#campo-confirmacao', confirmacao);
  await page.click('#btn-criar');
}

function emailDoSolo() {
  return `banca-${MARCA}@teclar.dev`;
}

// Digita o texto do exercício caractere por caractere, como num teclado:
// o treino captura pelo evento `input` do campo invisível, e o
// keyboard.type dispara um a cada caractere. Lição do Solo com repetições:
// digita de novo a cada volta, depois da passagem entre elas.
async function digitarTextoDoTreino(page) {
  for (let volta = 1; volta <= 20; volta++) {
    await page.locator('#texto span.c').first().waitFor();
    await page.locator('#passagem').waitFor({ state: 'hidden' });
    const texto = await page.locator('#texto').textContent();
    await page.locator('#area-texto').click();
    // 120 ms por tecla: uns 100 PPM, rápido mas ainda de gente (com 40 ms
    // dava 300 PPM, e o ranking da Ana ia para um ritmo impossível).
    await page.keyboard.type(texto, { delay: 120 });
    const proximo = await Promise.race([
      page.locator('#passagem').waitFor({ state: 'visible' }).then(() => 'passagem'),
      page.getByRole('dialog').waitFor().then(() => 'fim'),
      page.waitForURL('**/resultado.html**').then(() => 'fim'),
    ]);
    if (proximo === 'fim') return;
  }
  throw new Error('passou de 20 voltas sem terminar a lição');
}

// O número de uma métrica (PPM, Precisão, Erros...) do BlocoDeMetricas. Lê
// o valor FINAL, o span para leitor de tela do NumeroQueConta: o outro span
// ainda está contando enquanto a animação roda.
async function numeroDaMetrica(onde, rotulo) {
  const dd = onde.locator('.metrica', { has: onde.page().locator(`dt:text-is("${rotulo}")`) }).locator('dd');
  const valor = await dd.locator('span:not([aria-hidden]):not(.unidade)').first().textContent();
  return Number(valor.replace(/\D/g, ''));
}

async function metricasDoResultado(page) {
  const bloco = page.locator('.bloco-metricas');
  return {
    ppm: await numeroDaMetrica(bloco, 'PPM'),
    precisao: await numeroDaMetrica(bloco, 'Precisão'),
    erros: await numeroDaMetrica(bloco, 'Erros'),
  };
}

// Os números do resultado sobem contando (NumeroQueConta): espera o texto
// do bloco ficar igual em duas leituras seguidas antes de ler.
async function esperarNumerosParados(page) {
  let anterior = null;
  for (let i = 0; i < 40; i++) {
    const atual = await page.locator('main').textContent();
    if (atual === anterior) return;
    anterior = atual;
    await page.waitForTimeout(250);
  }
}

async function esperarToast(page, texto) {
  await page.locator('#toasts').getByText(texto).first().waitFor();
}

async function esperarTextoEm(page, seletor, padrao) {
  await page.locator(seletor).filter({ hasText: padrao }).first().waitFor();
}

function confere(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

// Cenário que depende de outro: sem o que o outro criou, falha dizendo qual.
function exigir(chave, cenario) {
  if (estado[chave] === undefined) throw new Error(`depende do ${cenario}, que falhou`);
}

// ============================================================================
// Execução
// ============================================================================

async function rodarCenario(navegador, cenario) {
  const contexto = await navegador.newContext();
  // A conta do professor do seed já viu o tutorial: ele só atrapalharia
  // cada cenário de professor. O do Solo é testado (S3 clica em "Pular").
  await contexto.addInitScript(() => localStorage.setItem('teclar:tutorial_professor:u-2', 'visto'));
  // O live-server recarrega toda página aberta quando um arquivo de teclar/
  // muda — e o próprio print de falha (testes-telas/falhas/) é um arquivo de
  // teclar/. Sem isto, o print de um cenário recarregava o seguinte no meio.
  // O websocket do live-reload fica falso: conecta e nunca avisa nada.
  await contexto.routeWebSocket(/\/ws$/, () => {});
  const page = await contexto.newPage();
  page.setDefaultTimeout(10_000);

  const problemas = [];
  page.on('pageerror', (erro) => problemas.push(`erro na página: ${erro.message}`));
  page.on('console', (mensagem) => {
    // "Failed to load resource" é o navegador repetindo o status de uma
    // resposta; quem decide se ela era prevista é o listener de response.
    if (mensagem.type() === 'error' && !mensagem.text().startsWith('Failed to load resource')) {
      problemas.push(`console: ${mensagem.text()}`);
    }
  });
  page.on('response', (resposta) => {
    if (resposta.status() < 400) return;
    const prevista = (cenario.previstos ?? []).some(
      ([status, trecho]) => resposta.status() === status && resposta.url().includes(trecho)
    );
    if (!prevista) problemas.push(`${resposta.status()} inesperado em ${resposta.request().method()} ${resposta.url()}`);
  });

  try {
    await cenario.rodar(page);
  } catch (erro) {
    problemas.unshift(erro.message.split('\n')[0]);
  }

  if (problemas.length > 0) {
    await page.screenshot({ path: path.join(PASTA_FALHAS, `${cenario.id}.png`), fullPage: true }).catch(() => {});
  }
  await contexto.close();
  return { cenario, problemas };
}

function rodarSeed() {
  execSync('npm run seed', { cwd: PASTA_BACK, stdio: 'ignore' });
}

// Sem os dois servidores não há o que testar: avisa logo, em vez de 40 falhas.
async function conferirServidores() {
  for (const url of [`${SITE}/pages/login.html`, `${BACK}/categorias`]) {
    try {
      await fetch(url);
    } catch {
      throw new Error(`Nada respondendo em ${url}. Suba o back (3000) e o live-server (5500).`);
    }
  }
}

function imprimir(resultados) {
  console.log('');
  for (const { cenario, problemas } of resultados) {
    const situacao = problemas.length === 0 ? 'passou' : 'FALHOU';
    console.log(`${situacao.padEnd(6)} ${cenario.id.padEnd(4)} ${cenario.nome}`);
    for (const p of problemas) console.log(`         - ${p}`);
  }
  const falhas = resultados.filter((r) => r.problemas.length > 0).length;
  console.log(`\n${resultados.length - falhas} de ${resultados.length} cenários passaram.`);
  return falhas;
}

async function principal() {
  await conferirServidores();
  rmSync(PASTA_FALHAS, { recursive: true, force: true });
  mkdirSync(PASTA_FALHAS, { recursive: true });

  rodarSeed();
  const navegador = await chromium.launch();
  const resultados = [];
  try {
    for (const cenario of cenarios) {
      const resultado = await rodarCenario(navegador, cenario);
      console.log(`${resultado.problemas.length === 0 ? 'ok   ' : 'FALHA'} ${cenario.id}`);
      resultados.push(resultado);
    }
  } finally {
    await navegador.close();
    rodarSeed();
  }
  const falhas = imprimir(resultados);
  process.exitCode = falhas > 0 ? 1 : 0;
}

await principal();
