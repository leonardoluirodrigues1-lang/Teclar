// preferencias-cedo.ts — as preferências do APARELHO (Configurações >
// Acessibilidade e Interface, nos três modos).
//
// Carregado como <script> COMUM (sem type="module") no <head> de todas as
// páginas, antes de qualquer CSS de tela: roda antes da primeira pintura e
// põe as classes no <html>, então a página já nasce no tamanho, no contraste
// e sem as animações escolhidas, sem piscar. Por isso não tem import nem
// export (o tsc o gera como script, não como módulo).
//
// É a única fonte da regra: os módulos (Configurações, Treino, movimento.ts)
// usam window.teclarPreferencias, via js/nucleo/preferencias.ts.
//
// Fica no localStorage, fora do prefixo "teclar:" que o Sair apaga: é do
// aparelho (quem pediu letra grande neste computador continua com ela), não
// da conta. localStorage pode estar bloqueado (modo privado, política da
// escola): aí vale o padrão e nada quebra.

type TamanhoDoTexto = 'normal' | 'grande' | 'muito-grande';

interface PreferenciasDoAparelho {
  texto: TamanhoDoTexto;
  altoContraste: boolean;
  reduzirMovimento: boolean;
  sonsDoTreino: boolean;
  tecladoGuia: boolean;
  dicas: boolean;
  transicoes: boolean;
}

interface Window {
  teclarPreferencias: {
    ler(): PreferenciasDoAparelho;
    definir<K extends keyof PreferenciasDoAparelho>(campo: K, valor: PreferenciasDoAparelho[K]): void;
  };
}

(() => {
  const CHAVE = 'teclar-preferencias';
  const TAMANHOS: TamanhoDoTexto[] = ['normal', 'grande', 'muito-grande'];
  const PADRAO: PreferenciasDoAparelho = {
    texto: 'normal',
    altoContraste: false,
    reduzirMovimento: false,
    sonsDoTreino: true,
    tecladoGuia: true,
    dicas: true,
    transicoes: true,
  };

  // Só aproveita do salvo o que tem o tipo certo: um valor estranho (editado
  // à mão, de uma versão antiga) cai no padrão daquele campo.
  function ler(): PreferenciasDoAparelho {
    const prefs = { ...PADRAO };
    try {
      const guardado = localStorage.getItem(CHAVE);
      // Antes desta página existir, o Solo guardava duas escolhas soltas:
      // quem já pediu menos movimento ou o teclado escondido não as perde.
      if (guardado === null) {
        prefs.reduzirMovimento = localStorage.getItem('teclar:movimento_reduzido') === 'sim';
        prefs.tecladoGuia = localStorage.getItem('teclar:teclado_guia_escondido') !== 'sim';
      }
      const salvo = JSON.parse(guardado ?? '{}');
      for (const campo of Object.keys(PADRAO) as (keyof PreferenciasDoAparelho)[]) {
        if (campo === 'texto') {
          if (TAMANHOS.includes(salvo?.texto)) prefs.texto = salvo.texto;
        } else if (typeof salvo?.[campo] === 'boolean') {
          prefs[campo] = salvo[campo];
        }
      }
    } catch {
      // JSON quebrado ou storage bloqueado: fica o padrão.
    }
    return prefs;
  }

  function aplicar(prefs: PreferenciasDoAparelho): void {
    const classes = document.documentElement.classList;
    classes.toggle('texto-grande', prefs.texto === 'grande');
    classes.toggle('texto-muito-grande', prefs.texto === 'muito-grande');
    classes.toggle('alto-contraste', prefs.altoContraste);
    classes.toggle('movimento-reduzido', prefs.reduzirMovimento);
    classes.toggle('sem-transicoes', !prefs.transicoes);
    classes.toggle('sem-dicas', !prefs.dicas);
  }

  function definir<K extends keyof PreferenciasDoAparelho>(campo: K, valor: PreferenciasDoAparelho[K]): void {
    const prefs = ler();
    prefs[campo] = valor;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch {
      // Sem storage, vale só nesta página.
    }
    aplicar(prefs);
  }

  window.teclarPreferencias = { ler, definir };
  aplicar(ler());
})();
