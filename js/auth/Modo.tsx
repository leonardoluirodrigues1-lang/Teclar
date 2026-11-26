// Modo.tsx — pages/modo.html
// Escolha de MODO: Solo, Professor ou Aluno. A landing ("Começar a treinar"
// e "Entrar") traz para cá, ANTES do login:
//   Solo / Professor -> o login de conta; o modo clicado fica guardado
//                       (guarda.guardarModoEscolhido) e, ao entrar, a conta
//                       vai direto para ele (também depois de criar conta).
//   Aluno            -> a entrada do aluno (?aluno=1: código, nome e senha).
// Quem já tem sessão de conta vê a mesma tela, com o "Olá, nome", e o clique
// vai direto ao modo. Aluno logado não escolhe modo: o guarda o devolve à sala.
//
// Modo não é perfil nem permissão: a mesma conta abre os dois, e pode
// trocar a qualquer hora pelo "Trocar de modo" das telas.
//
// O cartão Aluno com sessão de conta NÃO navega sozinho: aluno é outro tipo
// de sessão (tabela Alunos), então abre um modal avisando que vai sair da
// conta e, confirmado, encerra a sessão e manda para a entrada do aluno.
// Classes de css/auth.css; o modal é o ModalReact, com css/componentes/modais.css.

import { useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ROTA_INICIAL, ROTA_LOGIN } from '../config.js';
import { api, acordarServidor } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { Modo } from '../nucleo/tipos.js';
import { Modal } from '../componentes/ModalReact.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// O login já aberto no formulário de aluno (código da turma, nome e senha).
const ROTA_LOGIN_ALUNO = `${ROTA_LOGIN}?aluno=1`;

interface ConteudoCartao {
  nome: string;
  numero: string;
  resumo: string;
  itens: string[];
  rodape: string;
}

interface Cartao extends ConteudoCartao {
  modo: Modo;
}

const CARTOES: Cartao[] = [
  {
    modo: 'solo',
    nome: 'SOLO',
    numero: '01',
    resumo: 'Treino livre, no seu ritmo.',
    itens: ['76 lições em 10 níveis', 'XP e nível a cada treino', 'Lições que abrem em ordem'],
    rodape: 'Entrar no Solo',
  },
  {
    modo: 'professor',
    nome: 'PROFESSOR',
    numero: '02',
    resumo: 'Turmas, exercícios e relatórios.',
    // O que existe hoje: o aluno entra sozinho pelo código; a biblioteca
    // traz os exercícios do sistema; os relatórios têm gráficos.
    itens: [
      'Turmas com código de entrada',
      'Biblioteca com exercícios do sistema',
      'Relatórios com gráficos por turma e aluno',
    ],
    rodape: 'Entrar como professor',
  },
];

const CARTAO_ALUNO: ConteudoCartao = {
  nome: 'ALUNO',
  numero: '03',
  resumo: 'Entrar com o código da turma, o seu nome e a sua senha.',
  itens: ['As atividades da sua turma', 'Seu histórico e seus dias seguidos', 'O ranking da turma'],
  rodape: 'Entrar como aluno',
};

// O miolo de todo cartão — o mesmo desenho para os três.
function CorpoCartao({ cartao }: { cartao: ConteudoCartao }) {
  return (
    <>
      <div className="cartao-topo">
        <span className="cartao-nome">{cartao.nome}</span>
        <span className="cartao-numero" aria-hidden="true">
          {cartao.numero}
        </span>
      </div>
      <p className="cartao-resumo">{cartao.resumo}</p>
      <div className="cartao-divisoria" aria-hidden="true" />
      <ul className="cartao-itens">
        {cartao.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="cartao-rodape">
        <span>{cartao.rodape}</span>
        <span className="seta" aria-hidden="true">
          →
        </span>
      </div>
    </>
  );
}

// Sai da conta do mesmo jeito que o guarda.sair() — aviso ao back
// disparado e esquecido, sessão local apagada —, mas o destino é o login
// de aluno, não a landing. replace: o voltar não traz de volta uma tela
// de modo que já não tem sessão.
function sairParaAluno() {
  api.auth.sair().catch(() => {});
  sessao.sair();
  window.location.replace(ROTA_LOGIN_ALUNO);
}

function TelaModo() {
  const logado = sessao.logado();
  // Chave do modal aberto (null = fechado). Muda a cada abertura, como o
  // ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);

  // O href existe para o cartão ser link como os outros (Tab, Enter, leitor
  // de tela); o clique normal é interceptado e abre a confirmação.
  function aoClicarAluno(evento: MouseEvent) {
    if (!logado) return; // sem conta aberta, não há de que sair: segue o href
    evento.preventDefault();
    setModal(Date.now());
  }

  return (
    <>
      <div className="cabecalho">
        {logado && <p className="rotulo">Olá, {sessao.nomeExibicao()}</p>}
        <h1>Por onde vai hoje?</h1>
        <p>Dá para trocar a qualquer momento. Nada aqui é definitivo.</p>
      </div>

      {/* Os cartões são <a href>: a navegação é do próprio link (funciona
          com Enter, com o meio do mouse, com leitor de tela). Logado, o href
          é a casa do modo e o clique grava o modo (a tela de destino grava
          de novo, guarda.soConta). Sem login, o href é o login e o clique
          guarda o modo escolhido para depois da entrada. */}
      <nav className="cartoes" aria-label="Modos">
        {CARTOES.map((cartao) => (
          <a
            key={cartao.modo}
            className="cartao vidro"
            href={logado ? ROTA_INICIAL[cartao.modo] : ROTA_LOGIN}
            data-modo={cartao.modo}
            onClick={() => (logado ? sessao.definirModo(cartao.modo) : guarda.guardarModoEscolhido(cartao.modo))}
          >
            <CorpoCartao cartao={cartao} />
          </a>
        ))}
        <a
          className="cartao cartao-aluno vidro"
          href={ROTA_LOGIN_ALUNO}
          aria-haspopup={logado ? 'dialog' : undefined}
          onClick={aoClicarAluno}
        >
          <CorpoCartao cartao={CARTAO_ALUNO} />
        </a>
      </nav>

      {modal != null && (
        <Modal
          key={modal}
          eyebrow="Aluno"
          titulo="Entrar como aluno?"
          acoes={[
            { rotulo: 'Sair e entrar como aluno', principal: true, fecha: false, aoClicar: sairParaAluno },
            { rotulo: 'Cancelar' },
          ]}
          aoFechar={() => setModal(null)}
        >
          <p>Entrar como aluno vai sair da conta de {sessao.nomeExibicao()}.</p>
        </Modal>
      )}
    </>
  );
}

// Montagem — guarda primeiro, React depois

// Abre sem login e para sessão de conta; aluno logado volta para a sala
// dele (o guarda.exigir redireciona e devolve null).
if (!sessao.logado() || guarda.exigir('conta')) {
  // Sem login, o próximo passo é entrar: o back já vai subindo (ver api.acordarServidor).
  if (!sessao.logado()) acordarServidor();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<TelaModo />);
}
