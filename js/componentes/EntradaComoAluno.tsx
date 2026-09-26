// EntradaComoAluno.tsx
// O bloco "Sua entrada como aluno" da conta: o RP (GET /conta/rp), o botão
// de copiar e o que gera uma senha de aluno nova (POST
// /conta/rp/nova-senha). A senha atual nunca aparece aqui; a nova aparece
// uma vez, no modal, e some quando ele fecha.
//
// Mora nas Configurações dos dois modos: pages/solo/configuracoes.html e
// pages/professor/configuracoes.html. O item "Minha entrada como aluno" do
// menu (barra lateral no Solo, menu do nome no Professor) aponta para
// #entrada-aluno. Desenho em css/componentes/entrada-aluno.css; a página
// que usa carrega também css/componentes/modais.css.

import { useEffect, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import { BotaoCopiar } from './BotaoCopiar.js';
import { DadosDeEntrada } from './DadosDeEntrada.js';
import { Modal } from './ModalReact.js';
import { formatarRp } from '../utils/formato.js';

interface PropsEntradaComoAluno {
  /** Classes dos dois botões: cada modo tem a sua receita de botão. */
  classeBotao: string;
}

// O RP da conta, com botão de copiar, e a troca da senha de aluno.
// rp: undefined enquanto carrega; null quando a conta não tem RP (mostra
// "—", nunca "null").
export function EntradaComoAluno({ classeBotao }: PropsEntradaComoAluno) {
  const [rp, setRp] = useState<string | null | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  // Chave do modal aberto (null = fechado). Muda a cada abertura, como o
  // ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);
  const secao = useRef<HTMLElement>(null);

  // Quem chegou pelo item do menu (...#entrada-aluno) cai aqui. O navegador
  // tenta rolar até a âncora antes de o React desenhar o bloco, então a
  // rolagem é feita aqui, depois que ele existe.
  useEffect(() => {
    if (window.location.hash === '#entrada-aluno') secao.current?.scrollIntoView();
  }, []);

  useEffect(() => {
    let cancelado = false;
    api.conta
      .rp()
      .then((resposta) => {
        if (!cancelado) setRp(resposta?.rp ?? null);
      })
      .catch(() => {
        if (!cancelado) setFalhou(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <section className="vidro entrada-bloco" id="entrada-aluno" ref={secao} aria-labelledby="titulo-entrada-aluno">
      <span>
        <span className="entrada-bloco-nome" id="titulo-entrada-aluno">
          Sua entrada como aluno
        </span>
        <span className="entrada-rp" aria-live="polite">
          {falhou ? 'Não foi possível carregar o RP.' : rp === undefined ? 'Carregando…' : formatarRp(rp)}
        </span>
        <span className="entrada-bloco-texto">
          Com o RP e a senha de aluno você entra no modo aluno, e é pelo RP que o professor convida você
          para uma sala. A senha de aluno aparece uma vez só, quando é criada. Não tem a sua? Gere uma nova.
        </span>
      </span>
      {rp && (
        <span className="entrada-rp-acoes">
          <BotaoCopiar texto={rp} rotulo="Copiar RP" className={classeBotao} />
          <button type="button" className={classeBotao} onClick={() => setModal(Date.now())}>
            Gerar nova senha de aluno
          </button>
        </span>
      )}
      {modal !== null && <ModalNovaSenha key={modal} aoFechar={() => setModal(null)} />}
    </section>
  );
}

// Duas etapas no mesmo modal: primeiro a confirmação, avisando que a senha
// antiga deixa de valer; depois a senha nova, uma vez só. Ela vive só no
// estado deste modal: fechou, sumiu.
function ModalNovaSenha({ aoFechar }: { aoFechar: () => void }) {
  const [senhaNova, setSenhaNova] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // Com a senha na tela, fechar a aba ou recarregar a perde para sempre:
  // o navegador pergunta antes, como na tela do fim do cadastro.
  useEffect(() => {
    if (!senhaNova) return;
    function avisarAntesDeSair(evento: BeforeUnloadEvent) {
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', avisarAntesDeSair);
    return () => window.removeEventListener('beforeunload', avisarAntesDeSair);
  }, [senhaNova]);

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    setErro('');
    try {
      const resposta = await api.conta.novaSenhaAluno();
      setSenhaNova(resposta.senhaAluno);
    } catch {
      setErro('Não foi possível gerar a senha nova. A antiga continua valendo; tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  // As duas etapas usam o MESMO modal: trocar de <Modal> desmontaria um e
  // montaria outro, com a animação de entrada e o foco inicial de novo.
  // O botão principal é o primeiro nas duas, e por isso o foco continua
  // nele quando a etapa muda.
  if (senhaNova) {
    return (
      <Modal
        eyebrow="Senha de aluno"
        titulo="Sua senha de aluno nova"
        // Esc aqui apagaria a senha sem querer: só o botão fecha.
        fecharComEsc={false}
        acoes={[{ rotulo: 'Anotei, fechar', principal: true }]}
        aoFechar={aoFechar}
      >
        <DadosDeEntrada
          classeBotao="modal-botao modal-botao-vidro tecla"
          dados={[{ rotulo: 'Senha de aluno', exibido: senhaNova, copiar: senhaNova, rotuloCopiar: 'Copiar senha' }]}
        />
        <p className="entrada-aviso">
          Anote agora. <strong>Ela não aparece de novo.</strong>
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      eyebrow="Senha de aluno"
      titulo="Gerar nova senha?"
      acoes={[
        {
          rotulo: gerando ? 'Gerando…' : 'Gerar nova senha',
          principal: true,
          fecha: false,
          disabled: gerando,
          aoClicar: gerar,
        },
        { rotulo: 'Cancelar', disabled: gerando },
      ]}
      aoFechar={aoFechar}
    >
      <p>A senha de aluno de agora deixa de valer assim que a nova for gerada. O RP continua o mesmo.</p>
      {erro && <p role="alert">{erro}</p>}
    </Modal>
  );
}
