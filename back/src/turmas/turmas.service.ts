// turmas.service.ts
// A regra do grupo "Turmas (professor)" do CONTRATO-API.md, nas rotas que
// já existem: GET /turmas (ativas ou arquivadas), POST /turmas,
// PATCH /turmas/:id (renomear, trocar a capa, arquivar, desarquivar) e
// POST /turmas/:id/codigo/novo.
//
// Vale para todas:
//   - Só conta (Users) mexe em turma: token de aluno é 403 TIPO_INVALIDO.
//   - O ProfessorID sai SEMPRE do token. Nada do corpo nem da URL diz de
//     quem é a turma.
//   - Turma de outra conta é 404 NAO_ENCONTRADO, igual à que não existe:
//     um 403 confirmaria a quem tenta ids que aquela turma existe.
//   - Não existe excluir turma, só arquivar (Ativa = false): o histórico de
//     treino dos alunos continua.
import { randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BancoService } from '../banco/banco.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Identidade } from '../autenticacao/token.js';

// O corpo do POST /turmas como chega. Tudo unknown: vem da rede, e um curl
// pode mandar qualquer coisa. professorId está aqui só para ser RECUSADO
// (ver criar).
export interface CorpoDaTurmaNova {
  nome?: unknown;
  ano?: unknown;
  semestre?: unknown;
  professorId?: unknown;
}

// O corpo do PATCH /turmas/:id. Cada campo é uma das quatro operações;
// só o que vier muda.
export interface CorpoDaAlteracao {
  nome?: unknown;
  capaSemente?: unknown;
  ativa?: unknown;
}

// A turma na forma do tipo Turma do front (js/nucleo/tipos.ts).
export interface Turma {
  id: string;
  codigo: string;
  professorId: string;
  nome: string;
  totalAlunos: number;
  totalExercicios: number;
  periodo?: string;
  capaSemente?: number;
  ativa: boolean;
  dataCriacao: string;
}

export interface CodigoDaTurma {
  codigo: string;
}

// As duas contagens de toda resposta, feitas pelo banco (COUNT), nunca
// pela tela: alunos ativos da turma e exercícios atribuídos a ela.
const COM_CONTAGENS = {
  _count: { select: { alunos: { where: { Ativo: true } }, atribuicoesprof: true } },
} satisfies Prisma.classesprofInclude;

type TurmaComContagens = Prisma.classesprofGetPayload<{ include: typeof COM_CONTAGENS }>;

// O código que o professor escreve na lousa e o aluno digita no login: 6
// caracteres de A-Z e 2-9, sem I, O, 0 e 1, que se confundem à mão. Só
// maiúsculas, então o "l" minúsculo nem aparece.
const ALFABETO_DO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_DO_CODIGO = 6;

// Com 32^6 (~1 bilhão) de códigos, repetir é raríssimo; o limite só
// impede um laço infinito se algo der muito errado no banco.
const TENTATIVAS_DE_CODIGO = 5;

// Nome da turma: 3 a 100 caracteres (ClassesProf.NomeTurma é VARCHAR(100)).
const NOME_MINIMO = 3;
const NOME_MAXIMO = 100;

// Ano e CapaSemente são INT no MySQL: um número maior que isso daria erro
// 500 no INSERT, em vez de 400.
const MAIOR_INT = 2147483647;
const MENOR_INT = -2147483648;

@Injectable()
export class TurmasService {
  constructor(private readonly banco: BancoService) {}

  // GET /turmas e GET /turmas?ativa=false. Só "false" pede as arquivadas;
  // sem o parâmetro (ou com outro valor) vêm as ativas, como no mock.
  async listar(identidade: Identidade, ativa: string | undefined): Promise<Turma[]> {
    const professorId = professorDoToken(identidade);
    const turmas = await this.banco.classesprof.findMany({
      where: { ProfessorID: professorId, Ativa: ativa !== 'false' },
      include: COM_CONTAGENS,
      orderBy: { Data_Criacao: 'asc' },
    });
    return turmas.map(turmaNaForma);
  }

  // POST /turmas. Nasce ativa, com código e capa sorteados pelo back.
  async criar(identidade: Identidade, corpo: CorpoDaTurmaNova): Promise<Turma> {
    const professorId = professorDoToken(identidade);
    // Recusado, e não ignorado (como o usuario_id do POST /sessoes):
    // ignorar em silêncio faria quem mandou achar que escolheu o professor.
    if (corpo?.professorId !== undefined) {
      throw dadosInvalidos('O professor sai do login: não mande professorId.');
    }
    // Tudo validado antes de tocar no banco.
    const nome = nomeDaTurma(corpo?.nome);
    const ano = anoDaTurma(corpo?.ano);
    const semestre = semestreDaTurma(corpo?.semestre);
    await this.exigirNomeLivre(professorId, nome);

    const turma = await comCodigoNovo((codigo) =>
      this.banco.classesprof.create({
        data: {
          ClassID: randomUUID(),
          Codigo: codigo,
          ProfessorID: professorId,
          NomeTurma: nome,
          Ano: ano,
          Semestre: semestre,
          CapaSemente: sortearCapa(),
        },
        include: COM_CONTAGENS,
      }),
    );
    return turmaNaForma(turma);
  }

  // PATCH /turmas/:id. Pode vir mais de um campo; todos são validados antes
  // de gravar qualquer um, para não ficar meia alteração feita.
  async alterar(identidade: Identidade, id: string, corpo: CorpoDaAlteracao): Promise<Turma> {
    const professorId = professorDoToken(identidade);
    const atual = await this.turmaDaConta(professorId, id);

    const dados: Prisma.classesprofUpdateInput = {};
    if (corpo?.nome !== undefined) {
      dados.NomeTurma = nomeDaTurma(corpo.nome);
    }
    if (corpo?.capaSemente !== undefined) {
      dados.CapaSemente = capaDaTurma(corpo.capaSemente);
    }
    if (corpo?.ativa !== undefined) {
      dados.Ativa = ativaDaTurma(corpo.ativa);
    }
    // O nome só é único entre ativas, então quem confere é a turma como vai
    // FICAR: renomear uma ativa e desarquivar podem colidir; mexer numa
    // arquivada (ou arquivar) não.
    const ficaAtiva = typeof dados.Ativa === 'boolean' ? dados.Ativa : atual.Ativa;
    const ficaComNome = typeof dados.NomeTurma === 'string' ? dados.NomeTurma : atual.NomeTurma;
    if (ficaAtiva && ficaComNome !== null) {
      await this.exigirNomeLivre(professorId, ficaComNome, id);
    }

    const turma = await this.banco.classesprof.update({
      where: { ClassID: id },
      data: dados,
      include: COM_CONTAGENS,
    });
    return turmaNaForma(turma);
  }

  // POST /turmas/:id/codigo/novo. O código antigo para de valer na hora,
  // porque o login procura a turma por ClassesProf.Codigo e ele não está
  // mais lá. As senhas dos alunos ficam em Alunos e nem são tocadas.
  async novoCodigo(identidade: Identidade, id: string): Promise<CodigoDaTurma> {
    const professorId = professorDoToken(identidade);
    await this.turmaDaConta(professorId, id);

    const turma = await comCodigoNovo((codigo) =>
      this.banco.classesprof.update({ where: { ClassID: id }, data: { Codigo: codigo } }),
    );
    return { codigo: turma.Codigo };
  }

  // A turma, se for desta conta. Se não existe ou é de outra conta, o
  // mesmo 404 (ver o topo do arquivo).
  private async turmaDaConta(professorId: string, id: string) {
    const turma = await this.banco.classesprof.findFirst({
      where: { ClassID: id, ProfessorID: professorId },
    });
    if (!turma) {
      throw naoEncontrada();
    }
    return turma;
  }

  // 409 se a conta já tem outra turma ATIVA com esse nome. Arquivada não
  // conta (a mesma regra de Categorias): quem arquiva "9º Ano A — Manhã" no
  // fim do ano cria a do ano seguinte com o mesmo nome. A comparação é a da
  // collation do banco: "9º ano a" e "9º Ano A" são o mesmo nome. `exceto`
  // é a própria turma no PATCH; no criar fica undefined, e o Prisma ignora
  // o filtro.
  //
  // shortcut: entre esta consulta e o INSERT outra requisição pode criar o
  // mesmo nome (o banco não tem um UNIQUE só das ativas); se duplicar na
  // prática, criar uma coluna gerada (NomeTurma quando Ativa, senão NULL)
  // com UNIQUE (ProfessorID, essa coluna) e tratar o P2002.
  private async exigirNomeLivre(professorId: string, nome: string, exceto?: string): Promise<void> {
    const outra = await this.banco.classesprof.findFirst({
      where: { ProfessorID: professorId, NomeTurma: nome, Ativa: true, ClassID: { not: exceto } },
    });
    if (outra) {
      throw nomeEmUso();
    }
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

// O id da conta do token, ou 403 se o token é de aluno.
function professorDoToken(identidade: Identidade): string {
  if (identidade.tipo !== 'conta') {
    throw new ForbiddenException({ mensagem: 'Rota só para professores.', codigo: 'TIPO_INVALIDO' });
  }
  return identidade.id;
}

// Da linha do banco para a forma do contrato. Um lugar só monta, para as
// quatro rotas devolverem a mesma Turma.
function turmaNaForma(linha: TurmaComContagens): Turma {
  const turma: Turma = {
    id: linha.ClassID,
    codigo: linha.Codigo,
    professorId: linha.ProfessorID,
    nome: linha.NomeTurma ?? '',
    totalAlunos: linha._count.alunos,
    totalExercicios: linha._count.atribuicoesprof,
    ativa: linha.Ativa,
    // Só a data ("2026-02-01"), como o contrato pede.
    dataCriacao: linha.Data_Criacao ? linha.Data_Criacao.toISOString().slice(0, 10) : '',
  };
  // periodo e capaSemente são opcionais no tipo: sem valor, nem aparecem.
  const periodo = montarPeriodo(linha.Ano, linha.Semestre);
  if (periodo !== '') {
    turma.periodo = periodo;
  }
  if (linha.CapaSemente !== null) {
    turma.capaSemente = linha.CapaSemente;
  }
  return turma;
}

// "2026 · 1º semestre". Vem pronto do back para a tela não montar texto.
// Com só um dos dois, sai só ele; sem nenhum, texto vazio (sem periodo).
function montarPeriodo(ano: number | null, semestre: number | null): string {
  const partes: string[] = [];
  if (ano !== null) {
    partes.push(String(ano));
  }
  if (semestre !== null) {
    partes.push(`${semestre}º semestre`);
  }
  return partes.join(' · ');
}

function sortearCodigo(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) {
    // randomInt (do crypto), e não Math.random: o código é o que separa
    // um estranho do login da turma, então não pode ser previsível.
    codigo += ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)];
  }
  return codigo;
}

// Grava com um código sorteado. Se o banco recusar por repetição
// (ClassesProf.Codigo é UNIQUE), sorteia outro. Quem descobre a repetição
// é o próprio INSERT/UPDATE, e não uma consulta antes: entre as duas,
// outra requisição poderia pegar o mesmo código.
async function comCodigoNovo<T>(gravar: (codigo: string) => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await gravar(sortearCodigo());
    } catch (erro) {
      // P2002 é o código do Prisma para "violou um UNIQUE".
      const repetido = erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
      if (!repetido || tentativa === TENTATIVAS_DE_CODIGO) {
        throw erro;
      }
    }
  }
}

// A semente que desenha a capa. Qualquer inteiro serve; a tela só a usa
// para o desenho sair sempre igual para a mesma turma.
function sortearCapa(): number {
  return randomInt(1, 1_000_000);
}

// Nome aparado e com espaço repetido do meio reduzido a um, como o login
// faz com o nome do aluno: "9º  Ano A " e "9º Ano A" são a mesma turma.
function nomeDaTurma(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw dadosInvalidos('Informe o nome da turma.');
  }
  const nome = valor.trim().replace(/\s+/g, ' ');
  if (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {
    throw dadosInvalidos(`O nome da turma precisa ter de ${NOME_MINIMO} a ${NOME_MAXIMO} caracteres.`);
  }
  return nome;
}

// Opcional: sem ano, grava NULL.
function anoDaTurma(valor: unknown): number | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (!cabeNoInt(valor)) {
    throw dadosInvalidos('O ano precisa ser um número inteiro.');
  }
  return valor;
}

// Opcional: sem semestre, grava NULL.
function semestreDaTurma(valor: unknown): number | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (valor !== 1 && valor !== 2) {
    throw dadosInvalidos('O semestre precisa ser 1 ou 2.');
  }
  return valor;
}

function capaDaTurma(valor: unknown): number {
  if (!cabeNoInt(valor)) {
    throw dadosInvalidos('A semente da capa precisa ser um número inteiro.');
  }
  return valor;
}

function ativaDaTurma(valor: unknown): boolean {
  if (typeof valor !== 'boolean') {
    throw dadosInvalidos('O campo ativa precisa ser true ou false.');
  }
  return valor;
}

function cabeNoInt(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= MENOR_INT && (valor as number) <= MAIOR_INT;
}

// Os erros, no corpo que o contrato define para todo erro: { mensagem, codigo }.
function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}

function naoEncontrada(): NotFoundException {
  return new NotFoundException({ mensagem: 'Turma não encontrada.', codigo: 'NAO_ENCONTRADO' });
}

// O contrato só diz "409"; o código segue o padrão de CATEGORIA_DUPLICADA.
function nomeEmUso(): ConflictException {
  return new ConflictException({ mensagem: 'Você já tem uma turma com esse nome.', codigo: 'TURMA_DUPLICADA' });
}
