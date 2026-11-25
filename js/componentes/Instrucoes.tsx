// As instruções do post da atividade, desenhadas da árvore de
// utils/markdown.ts com elementos React: nenhum HTML de fora entra na página.
import { lerMarkdown, type Trecho } from '../utils/markdown.js';

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) => {
        if (t.tipo === 'texto') return <span key={i}>{t.texto}</span>;
        if (t.tipo !== 'link') {
          const Marca = t.tipo === 'negrito' ? 'strong' : 'em';
          return <Marca key={i}><Trechos trechos={t.filhos} /></Marca>;
        }
        return (
          <a key={i} className="link" href={t.href} target="_blank" rel="noopener noreferrer">
            <Trechos trechos={t.filhos} />
          </a>
        );
      })}
    </>
  );
}

export function Instrucoes({ texto }: { texto: string }) {
  const blocos = lerMarkdown(texto);
  if (blocos.length === 0) return null;
  return (
    <div className="instrucoes">
      {blocos.map((bloco, i) => {
        if (bloco.tipo === 'paragrafo') {
          return (
            <p key={i}>
              {bloco.linhas.map((linha, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  <Trechos trechos={linha} />
                </span>
              ))}
            </p>
          );
        }
        const Lista = bloco.tipo === 'lista' ? 'ul' : 'ol';
        return (
          <Lista key={i}>
            {bloco.itens.map((item, j) => (
              <li key={j}>
                <Trechos trechos={item} />
              </li>
            ))}
          </Lista>
        );
      })}
    </div>
  );
}
