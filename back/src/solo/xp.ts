// xp.ts
// As duas contas da gamificação do Solo: quanto XP uma sessão rende e em
// que nível um XP total está. São do back, e não da tela: se a tela
// calculasse o XP, bastava mandar outro número para subir de nível.
//
// Os números são os do front (CONFIG.SOLO em js/config.ts) e do mock, para
// a tela com mock e a tela com o back darem o mesmo XP:
//   concluída       XP_BASE_MISSAO + XP_BASE_MISSAO × (precisão / 100) × 0,5
//   não concluída   30% de XP_BASE_MISSAO, sem bônus
//   nível           (XP total ÷ XP por nível, sem a parte decimal) + 1
// Ex.: concluir com 96% de precisão dá 50 + round(50 × 0,96 × 0,5) = 74.

// XP base de toda lição. É uma constante, e não a coluna
// ExerciciosSolo.XPConcessao: o contrato decidiu que toda lição vale o
// mesmo (a coluna está em `naoUsadas`, no api.contrato.ts).
export const XP_BASE_MISSAO = 50;

// Fração do XP base que vira bônus com 100% de precisão: precisão 100%
// rende +50% do base; precisão 0%, nenhum bônus.
const MULTIPLICADOR_BONUS_PRECISAO = 0.5;

// Quem não terminou a lição ainda ganha um pouco, para o treino que não
// deu certo não valer zero; mas bem menos que terminar.
const FRACAO_SEM_CONCLUIR = 0.3;

export function xpDaSessao(concluida: boolean, precisao: number): number {
  if (!concluida) {
    return Math.round(XP_BASE_MISSAO * FRACAO_SEM_CONCLUIR);
  }
  return XP_BASE_MISSAO + Math.round(XP_BASE_MISSAO * (precisao / 100) * MULTIPLICADOR_BONUS_PRECISAO);
}

// O nível sai sempre do XP total, nunca de um "+1" guardado: assim o nível
// e o XP nunca contam histórias diferentes. Como o XP só cresce (nenhuma
// sessão tira XP), o nível também nunca desce por causa de uma sessão ruim.
export function nivelDoXp(xpTotal: number, xpPorNivel: number): number {
  return Math.floor(xpTotal / xpPorNivel) + 1;
}
