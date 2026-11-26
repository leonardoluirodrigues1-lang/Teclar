// O post da atividade (aba Atividades da turma, "Escrever post" / "Editar
// post"): título, instruções em Markdown com prévia, até 5 links, até 3
// anexos e as datas "Aberto em" e "Vencimento". É o que o aluno vê no topo
// da página da atividade (js/aluno/Atividade.tsx), como a tarefa do Moodle.
//
// Os anexos sobem na hora, um a um, e precisam do post salvo antes (o back
// guarda o anexo pendurado nele): sem post, a seção diz para salvar primeiro.
import { useEffect, useRef, useState } from 'react';
import { api } from '../nucleo/api.js';
import type { AnexoDoPost, ErroDaApi, LinkDoPost, PostDaAtividade } from '../nucleo/tipos.js';
import { Modal, type ModalHandle } from '../componentes/ModalReact.js';
import { Instrucoes } from '../componentes/Instrucoes.js';
import { baixarBase64, deDataLocal, formatarTamanho, lerComoDataUrl, paraDataLocal } from '../utils/arquivos.js';
import { formatarDataHora } from '../utils/formato.js';

const LINKS_MAXIMO = 5;
const ANEXOS_MAXIMO = 3;
const ANEXO_BYTES = 2 * 1024 * 1024;
const ACEITOS = '.pdf,.png,.jpg,.jpeg,.webp,.docx';

interface Props {
  turmaId: string;
  exercicioId: string;
  tituloDoExercicio: string;
  aoSalvar: (post: PostDaAtividade) => void;
  /** Anexo enviado ou removido: a lista da turma conta os anexos. */
  aoMudarAnexos: (quantos: number) => void;
  aoFechar: () => void;
}

export function ModalPost({ turmaId, exercicioId, tituloDoExercicio, aoSalvar, aoMudarAnexos, aoFechar }: Props) {
  const modal = useRef<ModalHandle>(null);
  const [post, setPost] = useState<PostDaAtividade | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [instrucoes, setInstrucoes] = useState('');
  const [links, setLinks] = useState<LinkDoPost[]>([]);
  const [abertoEm, setAbertoEm] = useState('');
  const [prazo, setPrazo] = useState('');
  const [anexos, setAnexos] = useState<AnexoDoPost[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.turmas
      .post(turmaId, exercicioId)
      .then((lido) => {
        setPost(lido);
        setTitulo(lido.titulo);
        setInstrucoes(lido.instrucoes);
        setLinks(lido.links);
        setAbertoEm(paraDataLocal(lido.abertoEm));
        setPrazo(paraDataLocal(lido.prazo));
        setAnexos(lido.anexos);
      })
      .catch((excecao) => setErroCarga(mensagem(excecao)));
  }, []);

  async function salvar() {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const salvo = await api.turmas.salvarPost(turmaId, exercicioId, {
        titulo: titulo.trim(),
        instrucoes,
        links: links.filter((l) => l.url.trim() !== '').map((l) => ({ titulo: l.titulo.trim(), url: l.url.trim() })),
        abertoEm: deDataLocal(abertoEm),
        prazo: deDataLocal(prazo),
      });
      aoSalvar(salvo);
      modal.current?.fechar();
    } catch (excecao) {
      setErro(mensagem(excecao));
      setOcupado(false);
    }
  }

  // Depois de enviar ou remover, o foco volta para dentro do editor: o botão
  // de anexar, ou (se ele sumiu, com 3 anexos) o último anexo. Sem isto o
  // foco caía no <body> (o input focado era desabilitado ou o botão
  // "Remover" clicado saía da tela) e o teclado deixava de rolar o modal.
  const secaoAnexos = useRef<HTMLFieldSetElement>(null);
  function devolverFoco() {
    requestAnimationFrame(() => {
      const alvo = arquivo.current?.isConnected
        ? arquivo.current
        : secaoAnexos.current?.querySelector<HTMLElement>('.lista-anexos li:last-child button');
      alvo?.focus({ preventScroll: true });
    });
  }

  async function enviarAnexo(escolhido: File | undefined) {
    // Trava em vez de `disabled` no input: desabilitar o input focado jogava o foco no <body>.
    if (!escolhido || enviandoAnexo) return;
    setErroAnexo(null);
    if (escolhido.size > ANEXO_BYTES) {
      setErroAnexo('O arquivo vai até 2 MB.');
      return;
    }
    setEnviandoAnexo(true);
    try {
      const novo = await api.turmas.enviarAnexo(turmaId, exercicioId, escolhido.name, await lerComoDataUrl(escolhido));
      const lista = [...anexos, novo];
      setAnexos(lista);
      aoMudarAnexos(lista.length);
    } catch (excecao) {
      setErroAnexo(mensagem(excecao));
    } finally {
      setEnviandoAnexo(false);
      if (arquivo.current) arquivo.current.value = '';
      devolverFoco();
    }
  }

  async function removerAnexo(anexo: AnexoDoPost) {
    setErroAnexo(null);
    try {
      await api.turmas.removerAnexo(turmaId, exercicioId, anexo.id);
      const lista = anexos.filter((a) => a.id !== anexo.id);
      setAnexos(lista);
      aoMudarAnexos(lista.length);
    } catch (excecao) {
      setErroAnexo(mensagem(excecao));
    }
    devolverFoco();
  }

  async function baixar(anexo: AnexoDoPost) {
    try {
      const { nome, tipo, conteudo } = await api.turmas.baixarAnexo(turmaId, exercicioId, anexo.id);
      baixarBase64(nome, tipo, conteudo);
    } catch (excecao) {
      setErroAnexo(mensagem(excecao));
    }
  }

  const trocarLink = (i: number, campo: keyof LinkDoPost, valor: string) =>
    setLinks((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <Modal
      ref={modal}
      eyebrow={tituloDoExercicio}
      titulo={post?.existe ? 'Editar post' : 'Escrever post'}
      acoes={[
        { rotulo: ocupado ? 'Salvando…' : 'Salvar post', principal: true, fecha: false, aoClicar: salvar, disabled: !post || ocupado },
        { rotulo: 'Cancelar' },
      ]}
      aoFechar={aoFechar}
    >
      {erroCarga && <p className="erro-campo" role="alert">{erroCarga}</p>}
      {!post && !erroCarga && <p>Carregando…</p>}
      {post && (
        <form className="form-exercicio editor-post" noValidate onSubmit={(e) => e.preventDefault()}>
          <div className="campo-modal">
            <label className="rotulo" htmlFor="post-titulo">Título</label>
            <input id="post-titulo" type="text" maxLength={150} value={titulo} placeholder={tituloDoExercicio} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="campo-modal">
            <label className="rotulo" htmlFor="post-instrucoes">Instruções</label>
            <textarea
              id="post-instrucoes"
              rows={4}
              maxLength={10000}
              aria-describedby="post-instrucoes-ajuda"
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
            />
            <p className="ajuda-campo" id="post-instrucoes-ajuda">
              Linha em branco separa parágrafos. **negrito**, *itálico*, “- ” no começo da linha faz lista, e [texto](https://...) faz link.
            </p>
            {instrucoes.trim() && (
              <div className="previa-instrucoes" aria-label="Prévia das instruções">
                <p className="rotulo">Prévia</p>
                <Instrucoes texto={instrucoes} />
              </div>
            )}
          </div>

          <fieldset className="campo-modal">
            <legend className="rotulo">Links (até {LINKS_MAXIMO})</legend>
            {links.map((link, i) => (
              <div className="linha-link" key={i}>
                <input type="text" aria-label={`Título do link ${i + 1}`} placeholder="Título" maxLength={150} value={link.titulo} onChange={(e) => trocarLink(i, 'titulo', e.target.value)} />
                <input type="url" aria-label={`Endereço do link ${i + 1}`} placeholder="https://" maxLength={2000} value={link.url} onChange={(e) => trocarLink(i, 'url', e.target.value)} />
                <button type="button" className="btn btn-vidro vidro tecla btn-pequeno" aria-label={`Tirar o link ${i + 1}`} onClick={() => setLinks((atual) => atual.filter((_, j) => j !== i))}>
                  Tirar
                </button>
              </div>
            ))}
            {links.length < LINKS_MAXIMO && (
              <button type="button" className="btn-texto" onClick={() => setLinks((atual) => [...atual, { titulo: '', url: '' }])}>
                + Adicionar link
              </button>
            )}
          </fieldset>

          <fieldset className="campo-modal" ref={secaoAnexos}>
            <legend className="rotulo">Anexos (até {ANEXOS_MAXIMO}, de até 2 MB: PDF, PNG, JPG, WEBP ou DOCX)</legend>
            {!post.existe ? (
              <p className="ajuda-campo">Salve o post primeiro; depois, em “Editar post”, você anexa os arquivos.</p>
            ) : (
              <>
                {anexos.length > 0 && (
                  <ul className="lista-anexos">
                    {anexos.map((anexo) => (
                      <li key={anexo.id}>
                        <button type="button" className="btn-texto" onClick={() => baixar(anexo)}>{anexo.nome}</button>
                        <span className="anexo-meta">
                          {formatarTamanho(anexo.tamanho)}{anexo.enviadoEm ? ` · enviado em ${formatarDataHora(anexo.enviadoEm)}` : ''}
                        </span>
                        <button type="button" className="btn btn-vidro vidro tecla btn-pequeno" aria-label={`Remover ${anexo.nome}`} onClick={() => removerAnexo(anexo)}>
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {anexos.length < ANEXOS_MAXIMO && (
                  <label className="btn btn-vidro vidro tecla btn-pequeno botao-arquivo">
                    {enviandoAnexo ? 'Enviando…' : 'Anexar arquivo'}
                    <input ref={arquivo} type="file" accept={ACEITOS} className="sr-only" aria-busy={enviandoAnexo} onChange={(e) => enviarAnexo(e.target.files?.[0])} />
                  </label>
                )}
              </>
            )}
            <p className="erro-campo" aria-live="polite">{erroAnexo}</p>
          </fieldset>

          <div className="campos-datas">
            <div className="campo-modal">
              <label className="rotulo" htmlFor="post-aberto">Aberto em</label>
              <input id="post-aberto" type="datetime-local" aria-describedby="post-aberto-ajuda" value={abertoEm} onChange={(e) => setAbertoEm(e.target.value)} />
              <p className="ajuda-campo" id="post-aberto-ajuda">Numa data futura, os alunos só veem a atividade a partir dela.</p>
            </div>
            <div className="campo-modal">
              <label className="rotulo" htmlFor="post-prazo">Vencimento (opcional)</label>
              <input id="post-prazo" type="datetime-local" aria-describedby="post-prazo-ajuda" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              <p className="ajuda-campo" id="post-prazo-ajuda">Depois dele o aluno ainda faz, mas a tentativa fica marcada com atraso.</p>
            </div>
          </div>

          <p className="erro-campo" role="alert">{erro}</p>
        </form>
      )}
    </Modal>
  );
}

function mensagem(excecao: unknown): string {
  const e = excecao as ErroDaApi;
  if (e?.name === 'ErroApi' && e.status === 400 && e.message) return e.message;
  if (e?.name === 'ErroApi' && e.status === 404) return 'Esta atividade não está mais na turma.';
  return 'Não foi possível salvar agora. Tente de novo.';
}
