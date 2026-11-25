// O post da atividade visto pelo PROFESSOR dono da turma (ver posts.ts):
//   GET    /turmas/:turmaId/atribuicoes/:exercicioId/post                     ler (com os padrões, se não há post)
//   PUT    /turmas/:turmaId/atribuicoes/:exercicioId/post                     criar ou editar
//   POST   /turmas/:turmaId/atribuicoes/:exercicioId/post/anexos              enviar um anexo
//   GET    /turmas/:turmaId/atribuicoes/:exercicioId/post/anexos/:anexoId     baixar
//   DELETE /turmas/:turmaId/atribuicoes/:exercicioId/post/anexos/:anexoId     remover
// Turma de outra conta, exercício não atribuído, post ou anexo que não
// existe: o mesmo 404. Retirar a atribuição apaga tudo (FK em cascata).
import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { professorDoToken, recusarProfessorIdNoCorpo } from '../autenticacao/professor-do-token.js';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import { dadosInvalidos } from '../dados-invalidos.js';
import { turmaDaConta } from '../turmas/turma-da-conta.js';
import {
  ANEXOS_MAXIMO,
  SEM_CONTEUDO,
  anexoNaForma,
  atribuicaoComPost,
  postNaForma,
  validarAnexo,
  validarPost,
} from './posts.js';
import type { AnexoDoPost, ArquivoDoAnexo, AtribuicaoComPost, CorpoDoAnexo, CorpoDoPost, PostDaAtividade } from './posts.js';

@Injectable()
export class PostsService {
  constructor(private readonly banco: BancoService) {}

  async ler(identidade: Identidade, turmaId: string, exercicioId: string): Promise<PostDaAtividade> {
    return postNaForma(await this.atribuicaoDoProfessor(identidade, turmaId, exercicioId));
  }

  async salvar(identidade: Identidade, turmaId: string, exercicioId: string, corpo: CorpoDoPost): Promise<PostDaAtividade> {
    recusarProfessorIdNoCorpo(corpo);
    const linha = await this.atribuicaoDoProfessor(identidade, turmaId, exercicioId);
    const post = validarPost(corpo, linha.exerciciosprof.Titulo, linha.Data_Atribuicao);
    const chave = { ClassID: turmaId, ExerciseID: exercicioId };
    const dados = { Titulo: post.titulo, Instrucoes: post.instrucoes, AbertoEm: post.abertoEm };
    await this.banco.$transaction([
      this.banco.atribuicoesposts.upsert({
        where: { ClassID_ExerciseID: chave },
        create: { ...chave, ...dados },
        update: dados,
      }),
      this.banco.atribuicoeslinks.deleteMany({ where: chave }),
      this.banco.atribuicoeslinks.createMany({
        data: post.links.map((link, ordem) => ({ ...chave, Ordem: ordem, Titulo: link.titulo, URL: link.url })),
      }),
      this.banco.atribuicoesprof.update({ where: { ClassID_ExerciseID: chave }, data: { Prazo: post.prazo } }),
    ]);
    return postNaForma((await atribuicaoComPost(this.banco, turmaId, exercicioId))!);
  }

  // O post tem de existir antes (o PUT): anexo é parte dele.
  async enviarAnexo(identidade: Identidade, turmaId: string, exercicioId: string, corpo: CorpoDoAnexo): Promise<AnexoDoPost> {
    recusarProfessorIdNoCorpo(corpo);
    const linha = await this.atribuicaoDoProfessor(identidade, turmaId, exercicioId);
    if (!linha.atribuicoesposts) {
      throw new NotFoundException({ mensagem: 'Salve o post antes de anexar arquivos.', codigo: 'NAO_ENCONTRADO' });
    }
    const anexo = validarAnexo(corpo);
    // shortcut: contar e depois gravar deixa dois envios simultâneos passarem do 3; trancar a linha do post se isso virar problema.
    if (linha.atribuicoesposts.atribuicoesanexos.length >= ANEXOS_MAXIMO) {
      throw dadosInvalidos(`O post já tem ${ANEXOS_MAXIMO} anexos: remova um para enviar outro.`);
    }
    const criado = await this.banco.atribuicoesanexos.create({
      data: {
        ID: randomUUID(),
        ClassID: turmaId,
        ExerciseID: exercicioId,
        NomeArquivo: anexo.nome,
        Tipo: anexo.tipo,
        Tamanho: anexo.bytes.length,
        Conteudo: new Uint8Array(anexo.bytes),
      },
      select: SEM_CONTEUDO,
    });
    return anexoNaForma(criado);
  }

  async baixarAnexo(identidade: Identidade, turmaId: string, exercicioId: string, anexoId: string): Promise<ArquivoDoAnexo> {
    await this.atribuicaoDoProfessor(identidade, turmaId, exercicioId);
    return arquivoDoAnexo(this.banco, turmaId, exercicioId, anexoId);
  }

  async removerAnexo(identidade: Identidade, turmaId: string, exercicioId: string, anexoId: string): Promise<void> {
    await this.atribuicaoDoProfessor(identidade, turmaId, exercicioId);
    const apagou = await this.banco.atribuicoesanexos.deleteMany({
      where: { ID: anexoId, ClassID: turmaId, ExerciseID: exercicioId },
    });
    if (apagou.count === 0) {
      throw anexoNaoEncontrado();
    }
  }

  private async atribuicaoDoProfessor(identidade: Identidade, turmaId: string, exercicioId: string): Promise<AtribuicaoComPost> {
    const professorId = professorDoToken(identidade);
    await turmaDaConta(this.banco, professorId, turmaId);
    const linha = await atribuicaoComPost(this.banco, turmaId, exercicioId);
    if (!linha) {
      throw new NotFoundException({ mensagem: 'Atribuição não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    return linha;
  }
}

// O único lugar que lê o Conteudo. Quem chama já conferiu quem pode baixar.
export async function arquivoDoAnexo(
  banco: BancoService,
  turmaId: string,
  exercicioId: string,
  anexoId: string,
): Promise<ArquivoDoAnexo> {
  const anexo = await banco.atribuicoesanexos.findFirst({
    where: { ID: anexoId, ClassID: turmaId, ExerciseID: exercicioId },
    select: { NomeArquivo: true, Tipo: true, Conteudo: true },
  });
  if (!anexo) {
    throw anexoNaoEncontrado();
  }
  return { nome: anexo.NomeArquivo, tipo: anexo.Tipo, conteudo: Buffer.from(anexo.Conteudo).toString('base64') };
}

function anexoNaoEncontrado(): NotFoundException {
  return new NotFoundException({ mensagem: 'Anexo não encontrado.', codigo: 'NAO_ENCONTRADO' });
}
