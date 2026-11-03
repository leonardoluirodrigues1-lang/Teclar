// Os ícones usados em mais de um arquivo (os dois tutoriais, o Caminho e a
// MolduraSolo), para não existirem duas cópias do mesmo desenho. Ícone que
// só uma tela usa mora no arquivo dela.
//
// SVG traçado em linha, escrito à mão. A cor e a espessura do traço vêm de
// .tutorial-icone svg, em css/componentes/tutorial.css.

export function IconeTeclado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

export function IconeSair() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconeGrafico() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  );
}

export function IconeEstrela() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z" />
    </svg>
  );
}

export function IconePessoa() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}
