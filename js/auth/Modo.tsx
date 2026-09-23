// Modo.tsx — pages/modo.html
// Escolha de MODO da conta, depois do login: Solo ou Professor. Só aparece
// para sessão de conta — aluno não passa por aqui (vai do login direto para
// o dashboard dele) e, se cair aqui, o guarda o devolve para lá.
//
// Modo não é perfil nem permissão: a mesma conta abre os dois, e pode
// trocar a qualquer hora pelo "Ir para ..." das telas. A escolha vai para a
// sessão (sessao.definirModo) e vale enquanto a conta navega. No próximo
// login esta tela aparece de novo: a conta sempre escolhe ao entrar (ver
// destinoAoEntrar() em js/nucleo/guarda.ts).
//
// O terceiro cartão, Aluno, NÃO é modo: aluno é outro tipo de sessão
// (tabela Alunos, login por matrícula). Por isso ele não navega sozinho —
// abre um modal avisando que vai sair da conta e, confirmado, encerra a
// sessão e manda para o login já no formulário de matrícula (?aluno=1).
//
// Substituiu a antiga tela de escolha de perfil (que ficava ANTES do login),
// removida quando o projeto passou a ter conta única. Classes de
// css/auth.css; o modal é o ModalReact, com css/componentes/modais.css.

import { useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ROTA_INICIAL, ROTA_LOGIN } from '../config.js';
import { api } from '../nucleo/api.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { Modo } from '../nucleo/tipos.js';
import { Modal } from '../componentes/ModalReact.js';
import { montarEstrelas } from './comum.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// O login já aberto no formulário de matrícula.
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
    itens: ['Campanhas com personagem', 'Níveis e XP por sessão', 'Missões que abrem por nível'],
    rodape: 'Entrar no Solo',
  },
  {
    modo: 'professor',
    nome: 'PROFESSOR',
    numero: '02',
    resumo: 'Turmas, exercícios e relatórios.',
    itens: [
      'Cadastro e importação de alunos',
      'Biblioteca de exercícios',
      'Desempenho por turma e aluno',
    ],
    rodape: 'Entrar como professor',
  },
];

const CARTAO_ALUNO: ConteudoCartao = {
  nome: 'ALUNO',
  numero: '03',
  resumo: 'Entrar com a matrícula da escola.',
  itens: ['Exercícios da sua turma', 'Seu histórico de desempenho', 'Acompanhado pelo professor'],
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
  // Chave do modal aberto (null = fechado). Muda a cada abertura, como o
  // ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);

  // O href existe para o cartão ser link como os outros (Tab, Enter, leitor
  // de tela); o clique normal é interceptado e abre a confirmação.
  function aoClicarAluno(evento: MouseEvent) {
    evento.preventDefault();
    setModal(Date.now());
  }

  return (
    <>
      <div className="cabecalho">
        <p className="rotulo">Olá, {sessao.nomeExibicao()}</p>
        <h1>Por onde vai hoje?</h1>
        <p>Dá para trocar a qualquer momento. Nada aqui é definitivo.</p>
      </div>

      {/* Os cartões são <a href> para a casa do modo: a navegação é do
          próprio link (funciona com Enter, com o meio do mouse, com leitor
          de tela). O clique grava o modo antes de o navegador seguir o
          href; a tela de destino grava de novo (guarda.soConta), então
          quem abrir o link numa aba nova chega no mesmo estado. */}
      <nav className="cartoes" aria-label="Modos">
        {CARTOES.map((cartao) => (
          <a
            key={cartao.modo}
            className="cartao vidro"
            href={ROTA_INICIAL[cartao.modo]}
            data-modo={cartao.modo}
            onClick={() => sessao.definirModo(cartao.modo)}
          >
            <CorpoCartao cartao={cartao} />
          </a>
        ))}
        <a
          className="cartao cartao-aluno vidro"
          href={ROTA_LOGIN_ALUNO}
          aria-haspopup="dialog"
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

      <p className="ajuda vidro">
        <span className="interrogacao" aria-hidden="true">
          ?
        </span>
        <span>
          A mesma conta serve para os dois. Você pode ter uma campanha no Solo e turmas como
          professor, e ir de um para o outro sem sair.
        </span>
      </p>
    </>
  );
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Só sessão de conta escolhe modo. Sem sessão vai para o login; aluno vai
// para o dashboard dele. Quando redireciona, nada abaixo roda.
if (guarda.exigir('conta')) {
  montarEstrelas(document.getElementById('estrelas'));
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<TelaModo />);
}
