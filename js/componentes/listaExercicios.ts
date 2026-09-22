// listaExercicios.ts
// Lista de exercícios dos dashboards mínimos. Recebe itens já normalizados
// pela tela e desenha: link para o treino quando disponível, item sem link
// com o requisito visível quando bloqueado, e os estados de carregando /
// vazio / erro — nunca tela em branco.
//
//   const lista = criarListaExercicios(document.getElementById('lista'));
//   lista.carregando();
//   lista.render([{ titulo, meta: ['Palavras comuns', 'fácil'], href: '...' },
//                 { titulo, meta: [...], bloqueado: 'Nível 4' }]);

export interface ItemListaExercicios {
  titulo: string;
  meta?: string[];
  href?: string;
  /** Texto do requisito (ex.: 'Nível 4'); com ele, o item sai sem link. */
  bloqueado?: string;
}

export interface ListaExercicios {
  carregando(texto?: string): void;
  vazio(texto?: string): void;
  erro(texto?: string): void;
  render(itens: ItemListaExercicios[] | null | undefined): void;
}

export function criarListaExercicios(host: HTMLElement | null): ListaExercicios {
  if (!host) throw new Error('criarListaExercicios: host obrigatório.');

  function estado(texto: string, erro = false) {
    host.innerHTML = '';
    const p = document.createElement('p');
    p.className = `estado${erro ? ' erro' : ''}`;
    p.textContent = texto;
    host.appendChild(p);
  }

  function carregando(texto = 'Carregando exercícios…') {
    estado(texto);
  }

  function vazio(texto = 'Nenhum exercício disponível por enquanto.') {
    estado(texto);
  }

  function erro(texto = 'Não foi possível carregar os exercícios.') {
    estado(texto, true);
  }

  // itens: [{ titulo, meta?: string[], href?: string, bloqueado?: string }]
  // `bloqueado` é o texto do requisito (ex.: 'Nível 4'); com ele, sem link.
  function render(itens: ItemListaExercicios[] | null | undefined) {
    if (!itens?.length) {
      vazio();
      return;
    }

    host.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'lista';

    itens.forEach((item) => {
      const li = document.createElement('li');
      const bloqueado = Boolean(item.bloqueado);

      const el: HTMLDivElement | HTMLAnchorElement = document.createElement(bloqueado ? 'div' : 'a');
      el.className = `item${bloqueado ? ' bloqueado' : ''}`;
      if (!bloqueado) (el as HTMLAnchorElement).href = item.href;
      if (bloqueado) el.setAttribute('aria-disabled', 'true');

      const texto = document.createElement('div');
      texto.className = 'item-texto';

      const titulo = document.createElement('p');
      titulo.className = 'item-titulo';
      titulo.textContent = item.titulo ?? 'Sem título';
      texto.appendChild(titulo);

      const meta = (item.meta ?? []).filter(Boolean);
      if (meta.length) {
        const p = document.createElement('p');
        p.className = 'item-meta';
        p.textContent = meta.join(' · ');
        texto.appendChild(p);
      }
      el.appendChild(texto);

      if (bloqueado) {
        const req = document.createElement('span');
        req.className = 'item-requisito';
        req.textContent = item.bloqueado;
        el.appendChild(req);
      } else {
        const seta = document.createElement('span');
        seta.className = 'item-seta';
        seta.setAttribute('aria-hidden', 'true');
        seta.textContent = '→';
        el.appendChild(seta);
      }

      li.appendChild(el);
      ul.appendChild(li);
    });

    host.appendChild(ul);
  }

  return { carregando, vazio, erro, render };
}

// A API pode devolver a lista crua ou no envelope de paginação
// { total, pagina, itens }. Devolve sempre um array.
export function desembrulhar<T>(resposta: T[] | { itens?: T[] } | null | undefined): T[] {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta?.itens)) return resposta.itens;
  return [];
}
