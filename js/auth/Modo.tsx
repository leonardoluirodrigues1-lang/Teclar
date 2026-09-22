// Modo.tsx — pages/modo.html
// Escolha de MODO da conta, depois do login: Solo ou Professor. Só aparece
// para sessão de conta — aluno não passa por aqui (vai do login direto para
// o dashboard dele) e, se cair aqui, o guarda o devolve para lá.
//
// Modo não é perfil nem permissão: a mesma conta abre os dois, e pode
// trocar a qualquer hora pelo "Ir para ..." das telas. A escolha vai para a
// sessão (sessao.definirModo) e, da próxima vez que a conta entrar, o
// login pula esta tela e cai direto no modo salvo.
//
// Substituiu a antiga tela de escolha de perfil (que ficava ANTES do login,
// com cartão de aluno), removida quando o projeto passou a ter conta única.
// Mesmo markup, mesmas classes de css/auth.css.

import { createRoot } from 'react-dom/client';
import { ROTA_INICIAL } from '../config.js';
import { guarda } from '../nucleo/guarda.js';
import { sessao } from '../nucleo/sessao.js';
import type { Modo } from '../nucleo/tipos.js';
import { montarEstrelas } from './comum.js';

interface Cartao {
  modo: Modo;
  nome: string;
  numero: string;
  resumo: string;
  itens: string[];
  rodape: string;
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

function TelaModo() {
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
          </a>
        ))}
      </nav>

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
  createRoot(document.getElementById('raiz')).render(<TelaModo />);
}
