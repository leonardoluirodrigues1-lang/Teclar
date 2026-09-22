// Esqueleto.tsx
// Os esqueletos de carregamento das telas do professor, na mesma altura e
// com o mesmo respiro dos elementos finais: quando os dados chegam, nada
// pula de lugar. Mesmas classes de css/escola.css que turmas.js e turma.js
// montavam à mão.

interface PropsQuantidade {
  quantidade: number;
}

/** A grade de cartões de turmas (barra do nome + duas métricas). */
export function EsqueletoGrade({ quantidade }: PropsQuantidade) {
  return (
    <div className="grade">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="esqueleto vidro" aria-hidden="true">
          <div className="esqueleto-barra" />
          <div className="esqueleto-metricas">
            <div className="esqueleto-metrica" />
            <div className="esqueleto-metrica" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Linhas de tabela, dentro do mesmo .tabela-painel da tabela final. */
export function EsqueletoTabela({ quantidade }: PropsQuantidade) {
  return (
    <div className="tabela-painel">
      <div>
        {Array.from({ length: quantidade }, (_, i) => (
          <div key={i} className="tabela-esqueleto-linha" aria-hidden="true">
            <div className="tabela-esqueleto-barra" />
          </div>
        ))}
      </div>
    </div>
  );
}
