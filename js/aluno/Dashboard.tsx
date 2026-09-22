// Dashboard.tsx — pages/aluno/dashboard.html
// Dashboard mínimo do Aluno: lista os exercícios atribuídos à turma ativa.
// Cada item leva ao treino com ?exercicio= e &turma=.
// Não é a tela final — é o suficiente para chegar ao treino.
//
// Conversão de js/aluno/dashboard.js para React: mesmo markup, mesmas
// classes de css/dashboard.css, mesmos textos e estados. A lista continua
// sendo desenhada por ../componentes/listaExercicios.ts (módulo ES puro):
// o React só entrega a <div id="lista"> e não põe filho nenhum nela.

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import type { Usuario } from '../nucleo/tipos.js';
import { criarListaExercicios, desembrulhar } from '../componentes/listaExercicios.js';

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
        <button type="button" className="btn-sair vidro" id="btn-sair" onClick={() => guarda.sair()}>
          Sair
        </button>
      </header>

      <h2 className="secao-rotulo">Exercícios da turma</h2>
      {/* Só o listaExercicios.ts escreve aqui dentro. */}
      <div id="lista" aria-live="polite" ref={hostLista} />
    </section>
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
  createRoot(document.getElementById('raiz')).render(<Dashboard usuario={usuario} />);
}
