// As preferências do aparelho para os módulos. A regra (padrões, leitura,
// gravação e as classes no <html>) mora em preferencias-cedo.ts, o script
// que o <head> de toda página carrega antes da pintura.
export type Preferencias = PreferenciasDoAparelho;
export type Tamanho = TamanhoDoTexto;

export const preferencias = window.teclarPreferencias;
