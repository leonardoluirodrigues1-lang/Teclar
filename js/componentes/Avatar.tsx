// Avatar.tsx — a foto de perfil ou, sem ela, a inicial do nome (como antes
// da foto existir). Usado no topo e na barra lateral (Moldura.tsx), em
// Configurações > Conta e na lista de alunos do professor.
import { useEffect, useReducer, useState } from 'react';
import { api } from '../nucleo/api.js';
import { EVENTO_USUARIO, sessao } from '../nucleo/sessao.js';

// "Leonardo" -> "L". Sem nome, fica vazio: melhor que um placeholder.
export function inicialDoNome(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
}

interface PropsAvatar {
  nome: string;
  /** A foto em data URL; sem ela, a inicial. */
  foto?: string | null;
  /** A classe do círculo (o tamanho vem dela). */
  classe?: string;
}

// Decorativo: o nome está sempre escrito ao lado, então o leitor de tela
// não ganha nada com "imagem" aqui.
export function Avatar({ nome, foto, classe = 'moldura-pessoa-inicial' }: PropsAvatar) {
  if (foto) {
    return <img className={`${classe} avatar-foto`} src={foto} alt="" aria-hidden="true" />;
  }
  return (
    <span className={classe} aria-hidden="true">
      {inicialDoNome(nome)}
    </span>
  );
}

// Redesenha quem chama quando o usuário salvo muda (nome ou foto trocados
// em Configurações): sessao.atualizarUsuario dispara EVENTO_USUARIO.
export function useUsuarioAtual(): void {
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(EVENTO_USUARIO, redesenhar);
    return () => window.removeEventListener(EVENTO_USUARIO, redesenhar);
  }, []);
}

// Um pedido por vez, mesmo com o topo e a barra pedindo juntos.
let pedindo = false;

/**
 * A foto de quem está logado. Ela fica no usuario da sessão (usuario.foto),
 * baixada uma vez quando o login diz temFoto; trocar ou remover em
 * Configurações atualiza o usuario, e quem usa este hook se redesenha pelo
 * EVENTO_USUARIO (useUsuarioAtual, acima).
 */
export function useMinhaFoto(): string | undefined {
  const usuario = sessao.usuario();
  const precisaBaixar = Boolean(usuario?.temFoto && !usuario.foto);
  useEffect(() => {
    if (!precisaBaixar || pedindo) return;
    pedindo = true;
    const pedido = sessao.tipo() === 'aluno' ? api.escola.aluno.foto() : api.conta.foto();
    pedido
      .then(({ imagem }) => sessao.atualizarUsuario({ foto: imagem }))
      // 404: a foto foi removida em outra aba ou aparelho; ficam as iniciais.
      // Outra falha (rede): tenta de novo na próxima tela.
      .catch((erro) => {
        if ((erro as { status?: number })?.status === 404) sessao.atualizarUsuario({ temFoto: false });
      })
      .finally(() => {
        pedindo = false;
      });
  }, [precisaBaixar]);
  return usuario?.foto;
}

// --- A foto do aluno na lista da turma (professor) ---------------------------

// As fotos já baixadas nesta página, por turma e aluno: reordenar ou filtrar
// a tabela não pede de novo.
const fotosDosAlunos = new Map<string, Promise<string | null>>();

function fotoDoAluno(turmaId: string, alunoId: string): Promise<string | null> {
  const chave = `${turmaId}/${alunoId}`;
  if (!fotosDosAlunos.has(chave)) {
    fotosDosAlunos.set(
      chave,
      api.alunos.foto(turmaId, alunoId).then(
        ({ imagem }) => imagem,
        () => null, // removida no meio do caminho ou rede fora: ficam as iniciais
      ),
    );
  }
  return fotosDosAlunos.get(chave);
}

/** O avatar do aluno na lista do professor: pede a foto só de quem temFoto. */
export function AvatarDoAluno({ turmaId, alunoId, nome, temFoto }: { turmaId: string; alunoId: string; nome: string; temFoto: boolean }) {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    if (!temFoto) return;
    let valendo = true;
    fotoDoAluno(turmaId, alunoId).then((imagem) => valendo && setFoto(imagem));
    return () => {
      valendo = false;
    };
  }, [turmaId, alunoId, temFoto]);
  return <Avatar nome={nome} foto={temFoto ? foto : null} classe="avatar-aluno" />;
}
