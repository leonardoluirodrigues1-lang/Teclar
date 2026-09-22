// Tabela.tsx
// A tabela sólida das telas do professor (turma: alunos e exercícios;
// matrícula: prévia do CSV). É a ÚNICA superfície sólida dessas telas —
// decisão do projeto: vidro é para painel e pílula, não para uma grade de
// números que precisa de contraste estável. Mesmo markup e mesmas classes
// que js/professor/turma.js montava à mão (.tabela-painel > .tabela).
//
// Cabeçalho com `campo` é ordenável: vira botão .tabela-ordenar com a seta,
// e o aria-sort acompanha o estado para quem usa leitor de tela. A REGRA de
// ordenação (nulo por último, etc.) fica com a tela: este componente só
// diz qual cabeçalho foi clicado e em que direção.

import type { ReactNode } from 'react';

export interface Ordenacao {
  /** null = ordem em que o back mandou. */
  campo: string | null;
  direcao: 'asc' | 'desc';
}

export interface ColunaTabela<T> {
  rotulo: string;
  /** Presente: o cabeçalho ordena por este campo. */
  campo?: string;
  /** Classe do <td> (col-mono, col-numero...), fixa ou por linha. */
  classe?: string | ((linha: T) => string | undefined);
  celula: (linha: T) => ReactNode;
}

interface PropsTabela<T> {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  classeLinha?: (linha: T) => string | undefined;
  ordenacao?: Ordenacao;
  aoOrdenar?: (ordenacao: Ordenacao) => void;
  /** Vai depois da tabela, dentro do painel (ex.: "Mostrando as 10 primeiras…"). */
  rodape?: ReactNode;
}

export function Tabela<T>({
  colunas,
  linhas,
  chave,
  classeLinha,
  ordenacao,
  aoOrdenar,
  rodape,
}: PropsTabela<T>) {
  // Ordena pelo campo dado, alterna asc/desc num campo já ativo.
  function ordenarPor(campo: string) {
    if (!ordenacao || !aoOrdenar) return;
    if (ordenacao.campo === campo) {
      aoOrdenar({ campo, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' });
    } else {
      aoOrdenar({ campo, direcao: 'asc' });
    }
  }

  function classeDe(coluna: ColunaTabela<T>, linha: T): string | undefined {
    return typeof coluna.classe === 'function' ? coluna.classe(linha) : coluna.classe;
  }

  return (
    <div className="tabela-painel">
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((coluna) => {
              if (!coluna.campo) {
                return (
                  <th key={coluna.rotulo} scope="col">
                    {coluna.rotulo}
                  </th>
                );
              }
              const ativo = ordenacao?.campo === coluna.campo;
              const direcao = ordenacao?.direcao ?? 'asc';
              return (
                <th
                  key={coluna.rotulo}
                  scope="col"
                  aria-sort={ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="tabela-ordenar"
                    onClick={() => ordenarPor(coluna.campo)}
                  >
                    {coluna.rotulo}
                    <span className="tabela-ordenar-seta" aria-hidden="true">
                      {ativo && direcao === 'desc' ? '▼' : '▲'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={chave(linha)} className={classeLinha?.(linha)}>
              {colunas.map((coluna) => (
                <td key={coluna.rotulo} className={classeDe(coluna, linha)}>
                  {coluna.celula(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rodape}
    </div>
  );
}
