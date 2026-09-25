// Configuracoes.tsx — pages/solo/configuracoes.html
// O que dá para configurar no Solo HOJE, sem coluna nova no banco. Aberta
// pela barra lateral (componentes/MolduraSolo.tsx).
//
// Três coisas, as três guardadas no navegador pela sessao.ts:
//   · reduzir movimento — aplicado pelo guarda.aplicarMundo(), que põe a
//     classe .movimento-reduzido no <html>; os tokens de duração de
//     css/base/movimento.css e tokens.css zeram com ela;
//   · esconder o teclado guia — o teclado embaixo do texto na tela de
//     treino (js/treino/Treino.tsx), que a tela lê ao abrir;
//   · rever o tutorial — apaga a marca de "já visto" da conta
//     (sessao.esquecerTutorial) e leva ao caminho, onde ele aparece.
//
// E um bloco que não é configuração, mas mora aqui por ser da conta: "Sua
// entrada como aluno", com o RP (GET /conta/rp) e o botão que gera uma
// senha de aluno nova (POST /conta/rp/nova-senha). A senha atual nunca
// aparece aqui; a nova aparece uma vez, no modal, e some quando ele fecha.

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../nucleo/api.js';
import { sessao } from '../nucleo/sessao.js';
import { guarda } from '../nucleo/guarda.js';
import { MolduraSolo } from '../componentes/MolduraSolo.js';
import { BotaoCopiar } from '../componentes/BotaoCopiar.js';
import { DadosDeEntrada } from '../componentes/DadosDeEntrada.js';
import { Modal } from '../componentes/ModalReact.js';
import { ativarSaidaAoNavegar } from '../utils/movimento.js';
import { formatarRp } from '../utils/formato.js';

// Vizinho desta em pages/solo/: é lá que o tutorial aparece.
const ROTA_CAMINHO = 'caminho.html';

function Configuracoes() {
  const [reduzir, setReduzir] = useState(sessao.movimentoReduzido());
  const [esconderTeclado, setEsconderTeclado] = useState(sessao.tecladoGuiaEscondido());

  function alternarMovimento(ligado: boolean) {
    sessao.definirMovimentoReduzido(ligado);
    // Reaplica na hora, sem recarregar: a própria tela já passa a valer.
    guarda.aplicarMundo();
    setReduzir(ligado);
  }

  function alternarTeclado(escondido: boolean) {
    sessao.definirTecladoGuiaEscondido(escondido);
    setEsconderTeclado(escondido);
  }

  function reverTutorial() {
    sessao.esquecerTutorial();
    window.location.href = ROTA_CAMINHO;
  }

  return (
    <MolduraSolo ativo="configuracoes">
      <main className="solo-texto">
        <h1 className="solo-texto-titulo">Configurações</h1>

        <section className="vidro solo-texto-cartao">
          {/* Checkbox de verdade, com o rótulo em volta: clicar no texto
              também marca, e o leitor de tela anuncia "marcado". */}
          <label className="solo-opcao">
            <input
              type="checkbox"
              className="solo-opcao-caixa"
              checked={reduzir}
              onChange={(evento) => alternarMovimento(evento.target.checked)}
            />
            <span>
              <span className="solo-opcao-nome">Reduzir movimento</span>
              <span className="solo-opcao-texto">
                Tira as animações das telas do Solo, do treino e do resultado: nada desliza nem
                cresce, tudo aparece direto no lugar. Se o seu computador já pede menos movimento, o
                TECLAR obedece mesmo com esta opção desmarcada.
              </span>
            </span>
          </label>
        </section>

        {/* A mesma forma da opção de cima. */}
        <section className="vidro solo-texto-cartao">
          <label className="solo-opcao">
            <input
              type="checkbox"
              className="solo-opcao-caixa"
              checked={esconderTeclado}
              onChange={(evento) => alternarTeclado(evento.target.checked)}
            />
            <span>
              <span className="solo-opcao-nome">Esconder o teclado guia</span>
              <span className="solo-opcao-texto">
                Tira da tela de treino o teclado desenhado embaixo do texto, que acende a próxima
                tecla e mostra com qual dedo apertá-la. Vale a partir do próximo treino.
              </span>
            </span>
          </label>
        </section>

        <section className="vidro solo-texto-cartao solo-opcao-linha">
          <span>
            <span className="solo-opcao-nome">Rever o tutorial</span>
            <span className="solo-opcao-texto">
              A apresentação do Solo, a mesma da primeira vez. Ela abre no caminho.
            </span>
          </span>
          <button type="button" className="tutorial-botao tecla" onClick={reverTutorial}>
            Rever
          </button>
        </section>

        <EntradaComoAluno />
      </main>
    </MolduraSolo>
  );
}

// O RP da conta, com botão de copiar, e a troca da senha de aluno.
// rp: undefined enquanto carrega; null quando a conta não tem RP (mostra
// "—", nunca "null").
function EntradaComoAluno() {
  const [rp, setRp] = useState<string | null | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  // Chave do modal aberto (null = fechado). Muda a cada abertura, como o
  // ModalReact pede.
  const [modal, setModal] = useState<number | null>(null);

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
    <section className="vidro solo-texto-cartao solo-opcao-linha" aria-labelledby="titulo-entrada-aluno">
      <span>
        <span className="solo-opcao-nome" id="titulo-entrada-aluno">
          Sua entrada como aluno
        </span>
        <span className="solo-rp" aria-live="polite">
          {falhou ? 'Não foi possível carregar o RP.' : rp === undefined ? 'Carregando…' : formatarRp(rp)}
        </span>
        <span className="solo-opcao-texto">
          Passe o RP para o professor: é com ele que o convite para uma sala chega a você. A senha de aluno
          apareceu só uma vez, quando a conta foi criada. Perdeu? Gere uma nova.
        </span>
      </span>
      {rp && (
        <span className="solo-rp-acoes">
          <BotaoCopiar texto={rp} rotulo="Copiar RP" className="tutorial-botao tecla" />
          <button type="button" className="tutorial-botao tecla" onClick={() => setModal(Date.now())}>
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

const usuario = guarda.soConta('solo');

if (usuario) {
  guarda.aplicarMundo();
  ativarSaidaAoNavegar();
  createRoot(document.getElementById('raiz')).render(<Configuracoes />);
}
