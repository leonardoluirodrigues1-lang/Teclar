// BotaoCopiar.tsx
// Botão que copia um texto para a área de transferência e responde no
// próprio rótulo ("Copiado"), sem depender de toast. Usado onde o RP ou a
// senha de aluno aparecem: a tela do fim do cadastro (js/auth/Cadastro.tsx)
// e o bloco da entrada de aluno (js/componentes/EntradaComoAluno.tsx).
//
// Quem usa este botão mostra o texto na tela ao lado dele. Por isso, se a
// área de transferência falhar (página fora de HTTPS, permissão negada), o
// rótulo só pede para copiar à mão: o texto já está ali para ser selecionado.

import { useEffect, useState } from 'react';

// Tempo em que o rótulo fica em "Copiado" antes de voltar ao normal.
const ESPERA_ROTULO_MS = 1600;

type Estado = 'parado' | 'copiado' | 'falhou';

interface PropsBotaoCopiar {
  texto: string;
  /** Rótulo normal do botão, ex.: "Copiar RP". */
  rotulo: string;
  /** Classes de aparência de quem usa (cada tela tem o seu botão). */
  className: string;
}

export function BotaoCopiar({ texto, rotulo, className }: PropsBotaoCopiar) {
  const [estado, setEstado] = useState<Estado>('parado');

  useEffect(() => {
    if (estado === 'parado') return;
    const espera = setTimeout(() => setEstado('parado'), ESPERA_ROTULO_MS);
    return () => clearTimeout(espera);
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
    } catch {
      setEstado('falhou');
    }
  }

  return (
    <button type="button" className={className} onClick={copiar} aria-live="polite">
      {estado === 'copiado' && 'Copiado'}
      {estado === 'falhou' && 'Selecione e copie'}
      {estado === 'parado' && rotulo}
    </button>
  );
}
