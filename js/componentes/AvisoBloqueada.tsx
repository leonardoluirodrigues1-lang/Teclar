// O aviso de quem abriu pela URL o treino de uma atividade bloqueada: a tela
// de treino devolve para o caminho ou a sala com ?bloqueada=1.

import { useState } from 'react';

// Tira o parâmetro da URL ao ler: o F5 não repete o aviso.
function leuParametro(): boolean {
  const url = new URL(location.href);
  if (!url.searchParams.has('bloqueada')) return false;
  url.searchParams.delete('bloqueada');
  history.replaceState(null, '', url);
  return true;
}

export function AvisoBloqueada() {
  const [mostrar] = useState(leuParametro);
  if (!mostrar) return null;
  return (
    <p className="vidro aviso-bloqueada" role="alert">
      Essa atividade ainda está bloqueada. Conclua a anterior primeiro.
    </p>
  );
}
