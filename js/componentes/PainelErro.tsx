// PainelErro.tsx
// O painel de estado das telas do professor (section.estado.vidro), que
// turmas.js, turma.js e alunos.js montavam como montarEstado(): título,
// texto e uma ação. PainelErro é o caso "não foi possível carregar", com o
// botão "Tentar de novo"; PainelEstado é a forma genérica, para os estados
// de vazio e de "turma não encontrada" — mesmas classes, mesma forma.
//
// role="status" só aqui, nunca na grade nem na tabela: o leitor de tela
// anuncia "não foi possível carregar" quando isso aparece, sem ler os 12
// cartões de uma listagem que deu certo.

import type { ReactNode } from 'react';

interface PropsEstado {
  titulo: string;
  texto: string;
  /** A ação: um botão ou um link, já com as classes .btn. */
  children?: ReactNode;
}

export function PainelEstado({ titulo, texto, children }: PropsEstado) {
  return (
    <section className="estado vidro" role="status">
      <h2 className="estado-titulo">{titulo}</h2>
      <p className="estado-texto">{texto}</p>
      {children}
    </section>
  );
}

interface PropsErro {
  titulo: string;
  texto: string;
  aoTentarDeNovo: () => void;
}

export function PainelErro({ titulo, texto, aoTentarDeNovo }: PropsErro) {
  return (
    <PainelEstado titulo={titulo} texto={texto}>
      <button type="button" className="btn btn-solido tecla tecla-clara" onClick={aoTentarDeNovo}>
        Tentar de novo
      </button>
    </PainelEstado>
  );
}
