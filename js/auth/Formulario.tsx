// Formulario.tsx
// As peças de formulário que Login.tsx e Cadastro.tsx repetem — o que no
// comum.js era mostrarErroCampo, linkErro, ocupar e ligarMostrarSenha.
// Aqui elas têm a forma que fazem sentido em React:
//
//   · erro embaixo do campo -> ESTADO (useErrosDeCampo) + <ErroCampo>. O
//     mostrarErroCampo escrevia texto no <p> e aria-invalid/.invalido no
//     input; agora a mensagem mora num mapa {campo -> erro} e os dois
//     elementos leem dela: o <p> por <ErroCampo>, o input por
//     atributosDeErro(). O `extra` (o link "Entrar" do 409) é um ReactNode
//     no mesmo registro, então some junto com a mensagem, como antes;
//   · linkErro -> não precisa de nada: é um <a className="link-erro"> em JSX;
//   · botão ocupado -> ESTADO `ocupado` na tela, com texto e disabled
//     derivados no próprio <button> (o mesmo que Alunos.tsx faz). O
//     ocupar() guardava o texto original no dataset porque o DOM era a
//     única memória; em React o texto original é o JSX;
//   · mostrar/esconder senha -> COMPONENTE <CampoSenha>: o tipo do input, o
//     texto, o aria-label e o aria-pressed do botão são o mesmo estado, e o
//     foco volta ao campo depois da troca.
//
// Os inputs continuam NÃO controlados: a tela lê .value por ref no blur e
// no envio, como o JS fazia. Assim o autocomplete do navegador preenche
// sem o React reescrever nada, e apagar a senha em caso de falha continua
// sendo `ref.current.value = ''`.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Validacao } from '../utils/validacao.js';

// ============================================================================
// Erro por campo
// ============================================================================

export interface ErroDeCampo {
  mensagem: string;
  /** Nó opcional acrescentado depois do texto (o link "Entrar" do 409). */
  extra?: ReactNode;
}

export interface DefinicaoCampo {
  ref: RefObject<HTMLInputElement>;
  /** null quando o valor está bom; a mensagem pronta quando está ruim. */
  checar: () => Validacao;
}

/**
 * Um mapa {nome do campo -> erro | null} e as três operações que as telas
 * fazem com ele: validar no blur, validar uma lista no envio e limpar.
 * Validação no blur e no envio — nunca a cada tecla: corrigir alguém no
 * meio da palavra é ruído, e todo campo fica vermelho antes de estar
 * terminado.
 */
export function useErrosDeCampo<N extends string>(campos: Record<N, DefinicaoCampo>) {
  const [erros, setErros] = useState<Partial<Record<N, ErroDeCampo | null>>>({});

  function definir(nome: N, mensagem: Validacao, extra?: ReactNode) {
    setErros((atual) => ({ ...atual, [nome]: mensagem ? { mensagem, extra } : null }));
  }

  // Campo em branco no blur não vira erro: a pessoa pode só ter passado por
  // ele com Tab. Quem cobra o obrigatório é o envio.
  function aoSair(nome: N) {
    const campo = campos[nome];
    if (campo.ref.current.value === '') {
      definir(nome, null);
      return;
    }
    definir(nome, campo.checar());
  }

  // Valida a lista inteira e devolve o nome do primeiro campo com erro (ou
  // null). Quem chama foca o campo.
  function validar(nomes: N[]): N | null {
    let primeiro: N | null = null;
    const novos: Partial<Record<N, ErroDeCampo | null>> = {};
    for (const nome of nomes) {
      const mensagem = campos[nome].checar();
      novos[nome] = mensagem ? { mensagem } : null;
      if (mensagem && !primeiro) primeiro = nome;
    }
    setErros((atual) => ({ ...atual, ...novos }));
    return primeiro;
  }

  function limpar() {
    setErros({});
  }

  return { erros, definir, aoSair, validar, limpar };
}

/** aria-invalid e .invalido do input, a partir do erro do campo. */
export function atributosDeErro(erro: ErroDeCampo | null | undefined) {
  const invalido = Boolean(erro);
  return { 'aria-invalid': invalido, className: invalido ? 'invalido' : undefined };
}

interface PropsErroCampo {
  id: string;
  erro: ErroDeCampo | null | undefined;
}

/** O <p class="erro-campo"> embaixo do input — nunca alert, nunca só console. */
export function ErroCampo({ id, erro }: PropsErroCampo) {
  return (
    <p className="erro-campo" id={id} aria-live="polite">
      {erro?.mensagem ?? ''}
      {erro?.extra != null && ' '}
      {erro?.extra}
    </p>
  );
}

// ============================================================================
// Senha com mostrar/esconder
// ============================================================================

interface PropsCampoSenha {
  id: string;
  name: string;
  autoComplete: string;
  /** ids para aria-describedby, separados por espaço. */
  describedBy: string;
  idBotao: string;
  erro: ErroDeCampo | null | undefined;
  inputRef: RefObject<HTMLInputElement>;
  onBlur: () => void;
}

/**
 * Botão de mostrar/esconder senha. O aria-label muda junto com o estado,
 * senão quem usa leitor de tela ouve "mostrar senha" com a senha já à
 * mostra. O foco volta para o campo: a pessoa estava digitando.
 */
export function CampoSenha({
  id,
  name,
  autoComplete,
  describedBy,
  idBotao,
  erro,
  inputRef,
  onBlur,
}: PropsCampoSenha) {
  const [visivel, setVisivel] = useState(false);
  // O foco volta DEPOIS de o tipo do input ter trocado no DOM, na mesma
  // ordem do ligarMostrarSenha (input.type = ...; input.focus()).
  const focarDepois = useRef(false);

  useEffect(() => {
    if (!focarDepois.current) return;
    focarDepois.current = false;
    inputRef.current?.focus();
  }, [visivel]);

  function alternar() {
    focarDepois.current = true;
    setVisivel((atual) => !atual);
  }

  return (
    <div className="campo-senha">
      <input
        type={visivel ? 'text' : 'password'}
        name={name}
        id={id}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        required
        ref={inputRef}
        onBlur={onBlur}
        {...atributosDeErro(erro)}
      />
      <button
        type="button"
        className="btn-olho"
        id={idBotao}
        aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        onClick={alternar}
      >
        {visivel ? 'Esconder' : 'Mostrar'}
      </button>
    </div>
  );
}
