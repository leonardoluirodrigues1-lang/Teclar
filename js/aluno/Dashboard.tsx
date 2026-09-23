// Dashboard.tsx — pages/aluno/dashboard.html
// A casa do Aluno: a <Nav> com as seções do aluno e um painel que lista os
// exercícios atribuídos à turma ativa, com um atalho para o histórico.
// Cada item leva ao treino com ?exercicio= e &turma=.
//
// Estilo: as classes de css/dashboard.css, com os ajustes do mundo Escola
// em css/escola.css (bloco .pagina-aluno). A lista é desenhada por
// ../componentes/listaExercicios.ts (módulo ES puro): o React só entrega a
// <div id="lista"> e não põe filho nenhum nela.

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Usuario } from '../nucleo/tipos.js';
import { criarListaExercicios, desembrulhar } from '../componentes/listaExercicios.js';
import { Nav, SECOES_ALUNO } from '../componentes/Nav.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';

// Vizinha desta em pages/aluno/: caminho relativo.
const ROTA_HISTORICO = 'historico.html';

interface PropsDashboard {
  usuario: Usuario;
}

function Dashboard({ usuario }: PropsDashboard) {
  const hostLista = useRef<HTMLDivElement>(null);

  const turmaId = sessao.turmaAtiva();
  const turma = usuario.turmas?.find((t) => t.id === turmaId);
  // Aluno não tem nome no banco (a tabela Alunos é matrícula e senha):
  // nomeExibicao() cai na matrícula em vez de escrever "undefined".
  const subtitulo = [sessao.nomeExibicao(), turma?.nome].filter(Boolean).join(' · ');

  useEffect(() => {
    let cancelado = false;
    const lista = criarListaExercicios(hostLista.current);
    lista.carregando();

    if (!turmaId) {
      lista.vazio('Você ainda não está em nenhuma turma.');
      return;
    }

    async function carregar() {
      let exercicios;
      try {
        exercicios = desembrulhar(await api.exercicios.daTurma(turmaId));
      } catch (erro) {
        if (!cancelado) lista.erro(erro?.message ?? 'Não foi possível carregar os exercícios.');
        return;
      }
      if (cancelado) return;

      lista.render(
        exercicios.map((e) => ({
          titulo: e.titulo,
          meta: [e.categoria, e.dificuldade, e.prazo ? `prazo ${formatarData(e.prazo)}` : null],
          href: `../treino/treino.html?${new URLSearchParams({ exercicio: e.id, turma: turmaId })}`,
        }))
      );
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      {/* A mesma <Nav> das outras telas, com as seções do aluno. O "Sair"
          que ficava solto no cabeçalho mora agora no menu do avatar dela,
          e é de lá que sai também o link para o histórico. SECOES_ALUNO
          não tem outroModo: aluno não troca de mundo. */}
      <Nav secoes={SECOES_ALUNO} ativo="exercicios" />

      <main className="conteudo">
        <section className="painel vidro" aria-labelledby="titulo">
          <header className="cabecalho">
            <div>
              <p className="rotulo">Aluno</p>
              <h1 className="titulo" id="titulo">
                Aluno
              </h1>
              <p className="subtitulo" id="subtitulo">
                {subtitulo}
              </p>
            </div>
            {/* O histórico também à mão aqui, além da nav: é para onde a
                pessoa vai depois de treinar, e é o único outro lugar que
                esta tela leva. */}
            <a className="btn-sair vidro" href={ROTA_HISTORICO}>
              Histórico
            </a>
          </header>

          <h2 className="secao-rotulo">Exercícios da turma</h2>
          {/* Só o listaExercicios.ts escreve aqui dentro. */}
          <div id="lista" aria-live="polite" ref={hostLista} />
        </section>
      </main>
    </>
  );
}

// 'AAAA-MM-DD' -> 'DD/MM/AAAA'; qualquer outro formato passa como veio.
function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

// ============================================================================
// Montagem — guarda primeiro, React depois
// ============================================================================

// Guarda de aluno antes de montar. Devolveu null, redirecionou: a tela
// para aqui e nada mais roda.
const usuario = guarda.soAluno();

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Dashboard usuario={usuario} />);
}
