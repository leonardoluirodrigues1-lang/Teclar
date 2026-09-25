// listaExercicios.ts
// Hoje só o desembrulhar(), que quase toda tela usa. O arquivo desenhava a
// lista de exercícios dos dashboards mínimos; a última a usar era a tela
// inicial do aluno, que passou a mostrar salas (js/aluno/Dashboard.tsx), e
// a lista saiu. O nome ficou para não mexer nos imports de nove telas.

// A API pode devolver a lista crua ou no envelope de paginação
// { total, pagina, itens }. Devolve sempre um array.
export function desembrulhar<T>(resposta: T[] | { itens?: T[] } | null | undefined): T[] {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta?.itens)) return resposta.itens;
  return [];
}
