// guarda.ts
// Impede que alguém chegue numa tela digitando a URL direto.
//
// ATENÇÃO: isto é conveniência de interface, NÃO segurança. Quem protege de
// verdade é o back, validando o token em toda requisição. Aqui só se evita
// que a pessoa veja uma tela quebrada, sem dado e sem sentido. Nada impede
// alguém de burlar este arquivo — e tudo bem, porque a API vai recusar.

import { ROTA_INICIAL, ROTA_LOGIN, ROTA_LANDING, ROTA_MODO, rotaInicial } from '../config.js';
import { api } from './api.js';
import { sessao } from './sessao.js';
import type { Usuario, Mundo, Modo, TipoSessao } from './tipos.js';

// Redireciona SUBSTITUINDO a entrada atual no histórico. Com replace, e não
// href, o botão voltar do navegador não devolve a pessoa para a tela que ela
// não pode ver — ele pula direto para a anterior a ela.
function irPara(url: string): void {
  window.location.replace(url);
}

// pathname + querystring da tela atual, para guardar no ?volta=.
function urlAtual(): string {
  return window.location.pathname + window.location.search;
}

// Lê o ?volta= da URL atual, já decodificado, só se for caminho interno.
// Barra única no começo: '//outrosite' e 'https://...' são recusados para
// não virar um pulo para fora do app.
function voltaSegura(): string | null {
  const volta = new URLSearchParams(window.location.search).get('volta');
  if (volta && volta.startsWith('/') && !volta.startsWith('//')) return volta;
  return null;
}

// Manda para o login carregando para onde a pessoa queria ir.
function mandarParaLogin(): void {
  irPara(`${ROTA_LOGIN}?volta=${encodeURIComponent(urlAtual())}`);
}

// A casa da sessão atual, para quem JÁ está navegando: aluno -> dashboard
// do aluno; conta -> a casa do modo em uso, ou a tela de modo se ainda não
// escolheu. Sem sessão, a landing. Não é usada logo depois do login: ver
// destinoAoEntrar().
function casa(): string {
  const tipo = sessao.tipo();
  return tipo ? rotaInicial(tipo, sessao.modo()) : ROTA_LANDING;
}

// Porteiro da tela. `tipoExigido` é 'conta', 'aluno' ou nada (qualquer
// sessão passa). Não há permissão por Solo/Professor: qualquer conta abre
// os dois — isso é modo, não identidade.
// Devolve o usuário quando passa; devolve null quando redirecionou — nesse
// caso a tela deve parar de executar imediatamente.
function exigir(tipoExigido?: TipoSessao | null): Usuario | null {
  // Não logado: vai para o login, guardando o destino no ?volta=.
  if (!sessao.logado()) {
    mandarParaLogin();
    return null;
  }

  const usuario = sessao.usuario();

  // Conta em tela de aluno, ou aluno em tela de conta: volta para a casa
  // do tipo dele.
  if (tipoExigido != null && usuario.tipo !== tipoExigido) {
    irPara(casa());
    return null;
  }

  return usuario;
}

// Telas do Solo e do Professor: exigem sessão de conta e, ao abrir, gravam
// o modo. A TELA é a fonte da verdade do modo: abriu uma do Solo, o modo é
// solo; abriu uma do Professor, é professor. Sem isso, o "Ir para ..." e a
// casa() trabalhariam com um modo velho.
function soConta(modo: Modo): Usuario | null {
  const usuario = exigir('conta');
  if (usuario) sessao.definirModo(modo);
  return usuario;
}

function soAluno(): Usuario | null {
  return exigir('aluno');
}

// A tela de treino e a de resultado são as mesmas para todo mundo: basta
// estar logado. Não mexem no modo.
function qualquerLogado(): Usuario | null {
  return exigir();
}

// Para onde a pessoa vai ao ENTRAR no sistema (login, cadastro, ou quem
// abre o login já logado). Aluno vai para o dashboard dele. Conta vai
// SEMPRE para a tela de modo, e não para o último modo usado: a mesma
// conta abre o Professor, o Solo e a entrada de aluno, e a cada entrada a
// pessoa escolhe onde quer estar, em vez de cair no mundo da última vez.
// O modo salvo continua valendo dentro da sessão (casa(), Nav).
function destinoAoEntrar(): string {
  if (sessao.tipo() === 'aluno') {
    return ROTA_INICIAL.aluno;
  }
  return ROTA_MODO;
}

// Para login.html e cadastro.html: quem já está logado não deveria ver a
// tela de login. Respeita o ?volta= se existir. Devolve true quando
// redirecionou.
function redirecionarSeLogado(): boolean {
  if (!sessao.logado()) return false;
  irPara(voltaSegura() ?? destinoAoEntrar());
  return true;
}

// Chamado logo depois de o login dar certo. Leva para o ?volta= (a tela que
// a pessoa tentou abrir antes, ex.: a sessão expirou no meio do trabalho)
// ou para o destino de quem entra.
function entrar(): void {
  irPara(voltaSegura() ?? destinoAoEntrar());
}

// "Ir para o Solo" / "Ir para Professor": troca o modo e navega. Sem
// logout, sem tela intermediária. href, e não replace: é navegação que a
// pessoa pediu, o voltar pode devolvê-la ao mundo de antes.
function trocarModo(modo: Modo): void {
  sessao.definirModo(modo);
  window.location.href = ROTA_INICIAL[modo];
}

// Encerra a sessão e volta para a landing.
// O aviso ao back é disparado e esquecido: se ele falhar, a sessão local
// some do mesmo jeito. O contrário — deixar a pessoa logada porque o
// /auth/logout caiu — seria o pior dos dois mundos.
function sair(): void {
  api.auth.sair().catch(() => {});
  sessao.sair();
  irPara(ROTA_LANDING);
}

// Marca o <body> com mundo-solo ou mundo-escola. O CSS troca densidade de
// espaçamento e raio de cartão a partir dessa classe, sem JS extra.
// Devolve o mundo aplicado ('solo' ou 'escola').
function aplicarMundo(): Mundo | null {
  const mundo = sessao.mundo();
  document.body.classList.remove('mundo-solo', 'mundo-escola');
  // Sem sessão, sessao.mundo() devolve null: nenhuma classe é aplicada.
  // Marcar o body com 'mundo-null' inventaria um mundo que não existe.
  if (mundo) document.body.classList.add(`mundo-${mundo}`);
  // O "reduzir movimento" de Configurações só existe no Solo, então só vale
  // nele (inclusive no treino e no resultado abertos pelo Solo). No <html>,
  // e não no <body>, porque os tokens de duração moram no :root.
  document.documentElement.classList.toggle(
    'movimento-reduzido',
    mundo === 'solo' && sessao.movimentoReduzido()
  );
  return mundo;
}

export const guarda = {
  exigir,
  soConta,
  soAluno,
  qualquerLogado,
  redirecionarSeLogado,
  casa,
  entrar,
  trocarModo,
  sair,
  aplicarMundo,
};
