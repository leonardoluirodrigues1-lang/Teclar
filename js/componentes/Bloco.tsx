// Um painel de vidro com título: o que agrupa o conteúdo das telas para
// ele não ficar solto sobre o fundo de estrelas. Mesmo vidro, borda e raio
// dos cartões de turma (.bloco, em css/componentes/vidro.css).
//
//   <Bloco titulo="Participantes" texto="Quem está na lista da turma.">...</Bloco>
import { useId, type ReactNode } from 'react';

interface PropsBloco {
  titulo: string;
  /** Uma frase curta abaixo do título. */
  texto?: ReactNode;
  /** À direita do título (um botão, um filtro). */
  acoes?: ReactNode;
  children: ReactNode;
}

export function Bloco({ titulo, texto, acoes, children }: PropsBloco) {
  const id = useId();
  return (
    <section className="bloco vidro" aria-labelledby={id}>
      <div className="bloco-cabeca">
        <div>
          <h2 className="bloco-titulo" id={id}>
            {titulo}
          </h2>
          {texto && <p className="bloco-texto">{texto}</p>}
        </div>
        {acoes && <div className="bloco-acoes">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}
