// estrelasJaVistas.ts
// Decide quais estrelas de conquista são NOVAS — as que merecem nascer com
// o pulso (.estrela-nasce, css/base/movimento.css).
//
// A regra: a estrela pulsa só na primeira vez que a pessoa a vê. Uma tela
// que já tinha dez estrelas, recarregada, mostra as dez prontas. Para isso
// o aparelho guarda, por pessoa e por tela, as estrelas que ela já viu
// (localStorage). Estrela que não está na lista é nova: pulsa, e entra na
// lista na mesma hora.
//
// Primeira visita a uma tela neste aparelho: não há lista ainda, e nada
// pulsa — não dá para saber quais estrelas são de hoje. A tela só aprende
// o que já existe. Na prática quase não acontece, porque a pessoa passa
// pelo caminho, pelo lobby e pela sala antes de conquistar alguma coisa.
//
// Quem usa: solo/Caminho.tsx (pedra concluída), solo/Lobby.tsx (dia com
// treino) e aluno/Sala.tsx (exercício feito). O resultado do treino não
// precisa: lá o selo só existe logo depois da sessão (ver Resultado.tsx).

import { useRef } from 'react';
import { CONFIG } from '../config.js';
import { sessao } from '../nucleo/sessao.js';

// grupo (a tela, ex.: 'caminho') -> as chaves das estrelas já vistas nele.
type Memoria = Record<string, string[]>;

function chaveDoStorage(): string | null {
  const usuario = sessao.usuario();
  if (!usuario) return null;
  return CONFIG.CHAVES_STORAGE.ESTRELAS_VISTAS + usuario.id;
}

function lerMemoria(chave: string): Memoria {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? '{}') ?? {};
  } catch {
    // Valor corrompido: recomeça do zero. O pior que acontece é uma
    // estrela antiga não pulsar.
    return {};
  }
}

function gravarMemoria(chave: string, memoria: Memoria): void {
  try {
    localStorage.setItem(chave, JSON.stringify(memoria));
  } catch {
    // Storage cheio ou bloqueado: o pulso é acabamento, a tela segue.
  }
}

/**
 * Chamar no componente da tela, a cada render, com as chaves das estrelas
 * que a tela mostra agora (o id da lição, o dia 'AAAA-MM-DD'...). Enquanto
 * os dados não chegaram, passar null: uma lista vazia seria lida como "esta
 * tela não tem estrela nenhuma".
 *
 * Devolve `ehNova(chave)`. Ela responde true UMA vez por estrela nova: quem
 * perguntou passa o true para a <Estrela nasce>, que guarda o valor ao
 * montar. Nas perguntas seguintes (outro render, a pedra desmontada e
 * montada de novo ao trocar de nível) a resposta é false, e a estrela não
 * pulsa duas vezes na mesma visita.
 */
export function useEstrelasNovas(grupo: string, chavesAtuais: string[] | null): (chave: string) => boolean {
  // As chaves já comparadas com a memória nesta visita, e as novas que
  // ainda não foram entregues a nenhuma estrela.
  const conferidas = useRef(new Set<string>());
  const novas = useRef(new Set<string>());

  const chaveStorage = chaveDoStorage();
  const naoConferidas = (chavesAtuais ?? []).filter((chave) => !conferidas.current.has(chave));

  if (chaveStorage && naoConferidas.length > 0) {
    const memoria = lerMemoria(chaveStorage);
    const vistas = memoria[grupo];
    for (const chave of naoConferidas) {
      conferidas.current.add(chave);
      if (vistas && !vistas.includes(chave)) novas.current.add(chave);
    }
    // ponytail: a lista só cresce (um dia a mais por dia treinado);
    // são textos curtos, anos de uso cabem com folga no localStorage.
    memoria[grupo] = [...(vistas ?? []), ...naoConferidas];
    gravarMemoria(chaveStorage, memoria);
  }

  return (chave: string) => {
    if (!novas.current.has(chave)) return false;
    novas.current.delete(chave);
    return true;
  };
}
