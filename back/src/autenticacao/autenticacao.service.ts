// autenticacao.service.ts
// A regra do grupo Autenticação (ver CONTRATO-API.md): o POST /auth/login,
// o POST /auth/cadastro e o GET /auth/eu. O logout não tem regra (ver o
// controller). Abaixo, o que vale para o login:
//
// Um login para duas tabelas:
//   conta (Users)  -> { email, senha }
//   aluno (Alunos) -> { codigo, nome, senha }
// É a presença de `codigo` no corpo que diz qual tabela procurar.
// Responde { token, usuario } e, só no primeiro acesso do aluno,
// primeiroAcesso: true.
//
// Credencial errada é sempre o mesmo 401 CREDENCIAIS, exista a conta ou
// não, e no aluno sem dizer se o errado foi o código, o nome ou a senha:
// qualquer pista transformaria o login num jeito de descobrir quem tem
// conta, ou quem está em qual turma.
//
// O aluno (banco v8) é POR TURMA: a linha de Alunos já tem o ClassID. O
// mesmo nome em duas turmas são duas pessoas para o banco, cada uma com a
// sua senha — o código da turma é o que diz de qual delas se trata.
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { BancoService } from '../banco/banco.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { problemaNaSenhaDaConta, problemaNoEmail, problemaNoNome } from './regras-do-cadastro.js';
import { problemaNaSenhaDoAluno } from './senha-do-aluno.js';
import type { ConteudoDoToken, Identidade, TipoDeLogin } from './token.js';

// O corpo como chega. Tudo unknown: vem da rede, e nada garante que a tela
// (ou quem chamar com curl) mandou texto.
export interface CorpoDoLogin {
  email?: unknown;
  codigo?: unknown;
  nome?: unknown;
  senha?: unknown;
}

// O corpo do cadastro como chega (DadosCadastro no contrato). Tudo
// unknown, pelo mesmo motivo do CorpoDoLogin.
export interface CorpoDoCadastro {
  nome?: unknown;
  email?: unknown;
  senha?: unknown;
}

// A resposta, campo a campo como no contrato. Nada de hash, GoogleID ou
// Ativo: o que não está aqui não sai do back.
interface UsuarioConta {
  id: string;
  nome: string;
  email: string;
  tipo: 'conta';
  // Só existe se a conta tem campanha no Solo (como no mock): a tela usa
  // para abrir o lobby sem pedir a campanha de novo.
  campanhaAtiva?: string;
}

interface UsuarioAluno {
  id: string;
  nome: string;
  tipo: 'aluno';
  // Uma turma só (o aluno é por turma), mas em lista: é a forma que o
  // contrato e a tela já usam.
  turmas: { id: string; nome: string }[];
}

export type Usuario = UsuarioConta | UsuarioAluno;

export interface RespostaLogin {
  token: string;
  usuario: Usuario;
  // Só vem, e só true, quando a senha do aluno acabou de ser gravada.
  primeiroAcesso?: true;
}

// Custo do bcrypt ao gravar a senha do primeiro acesso: o mesmo do seed.
// O custo fica gravado dentro do hash, então comparar não depende dele.
const CUSTO_BCRYPT = 10;

// Um hash bcrypt de verdade, de uma senha que ninguém sabe. Quando o e-mail
// (ou o aluno) não existe, a senha é comparada com ele mesmo assim: sem
// isso o "não existe" responderia em 1 ms e o "senha errada" em ~70 ms (o
// tempo do bcrypt), e a demora denunciaria quem existe.
const HASH_DE_NINGUEM = bcrypt.hashSync('nenhuma-senha-confere-com-este-hash', CUSTO_BCRYPT);

@Injectable()
export class AutenticacaoService {
  constructor(
    private readonly banco: BancoService,
    private readonly jwt: JwtService,
  ) {}

  async entrar(corpo: CorpoDoLogin): Promise<RespostaLogin> {
    // As pontas da senha são aparadas antes de tudo: senha colada costuma
    // trazer espaço ou quebra de linha no fim. É seguro porque nenhuma
    // senha gravada tem espaço nas pontas — a de conta é recusada assim no
    // cadastro, e a de aluno é gravada já aparada (ver entrarComoAluno).
    const senha = String(corpo?.senha ?? '').trim();

    if (corpo?.codigo !== undefined) {
      return this.entrarComoAluno(normalizarCodigo(corpo.codigo), normalizarNome(corpo.nome), senha);
    }
    return this.entrarComoConta(normalizarEmail(corpo?.email), senha);
  }

  // ==========================================================================
  // Conta (Users)
  // ==========================================================================

  private async entrarComoConta(email: string, senha: string): Promise<RespostaLogin> {
    const conta = await this.banco.users.findUnique({
      where: { Email: email },
      // A campanha do Solo vem junto, pela relação users -> campanhassolo.
      // Um jogador tem uma campanha só; o take: 1 deixa isso explícito.
      include: { campanhassolo: { select: { CampanhaID: true }, take: 1 } },
    });

    // Compara ANTES de olhar se a conta existe (ver HASH_DE_NINGUEM).
    // SenhaHash NULL é conta que só entra pelo Google: nenhuma senha serve.
    const senhaCerta = await senhaConfere(senha, conta?.SenhaHash ?? null);
    if (!conta || !senhaCerta) {
      throw credenciaisInvalidas();
    }
    // Só depois da senha certa: responder 403 para senha errada contaria
    // que o e-mail existe.
    if (conta.Ativo === false) {
      throw contaDesativada();
    }

    return { token: await this.emitirToken(conta.ID, 'conta'), usuario: usuarioDaConta(conta) };
  }

  // ==========================================================================
  // Cadastro (só conta: aluno não se cadastra, é importado pelo professor)
  // ==========================================================================

  async cadastrar(corpo: CorpoDoCadastro): Promise<RespostaLogin> {
    // Nome e e-mail são aparados (espaço nas pontas é sempre engano de
    // digitação). A senha NÃO: ver problemaNaSenhaDaConta.
    const nome = normalizarNome(corpo?.nome);
    const email = normalizarEmail(corpo?.email);
    const senha = String(corpo?.senha ?? '');

    const problema = problemaNoNome(nome) ?? problemaNoEmail(email) ?? problemaNaSenhaDaConta(senha);
    if (problema !== null) {
      throw dadosInvalidos(problema);
    }

    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);

    // O e-mail repetido é descoberto pelo próprio INSERT (Users.Email é
    // UNIQUE), e não por um findUnique antes: entre o "não existe" e o
    // INSERT, outra requisição poderia cadastrar o mesmo e-mail. Só o
    // banco responde isso sem essa janela.
    //
    // Cria só a linha em Users, como o contrato diz: a campanha do Solo
    // nasce quando a pessoa aperta o botão do lobby (POST /solo/campanha).
    let conta;
    try {
      conta = await this.banco.users.create({
        data: { ID: randomUUID(), Nome: nome, Email: email, SenhaHash: hash },
      });
    } catch (erro) {
      // P2002 é o código do Prisma para "violou um UNIQUE".
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw emailEmUso();
      }
      throw erro;
    }

    // Conta recém-criada não tem campanha: o usuario sai sem campanhaAtiva.
    const usuario = usuarioDaConta({ ...conta, campanhassolo: [] });
    return { token: await this.emitirToken(conta.ID, 'conta'), usuario };
  }

  // ==========================================================================
  // Quem sou eu (GET /auth/eu)
  // ==========================================================================

  // O dono do token, lido de novo do banco, na mesma forma do login. Lê do
  // banco, e não só do token, porque o token guarda só id e tipo — e
  // porque a conta pode ter sido desativada depois do login.
  quemSouEu(identidade: Identidade): Promise<Usuario> {
    if (identidade.tipo === 'aluno') {
      return this.alunoDoToken(identidade.id);
    }
    return this.contaDoToken(identidade.id);
  }

  private async contaDoToken(id: string): Promise<UsuarioConta> {
    const conta = await this.banco.users.findUnique({
      where: { ID: id },
      include: { campanhassolo: { select: { CampanhaID: true }, take: 1 } },
    });
    // Conta apagada ou desativada depois do login: a assinatura do token
    // ainda confere, mas a sessão acabou. É o mesmo 401 do token vencido,
    // para a tela voltar ao login — e lá a pessoa recebe o motivo de
    // verdade (403 CONTA_INATIVA).
    if (!conta || conta.Ativo === false) {
      throw tokenInvalido();
    }
    return usuarioDaConta(conta);
  }

  private async alunoDoToken(id: string): Promise<UsuarioAluno> {
    const aluno = await this.banco.alunos.findUnique({
      where: { ID: id },
      include: { classesprof: { select: { ClassID: true, NomeTurma: true, Ativa: true } } },
    });
    // Mesmo raciocínio da conta: aluno removido, desativado, ou com a
    // turma arquivada depois do login perde a sessão.
    if (!aluno || aluno.Ativo === false || aluno.classesprof.Ativa === false) {
      throw tokenInvalido();
    }
    return usuarioDoAluno(aluno);
  }

  // ==========================================================================
  // Aluno (Alunos, dentro de uma turma)
  // ==========================================================================

  private async entrarComoAluno(codigo: string, nome: string, senha: string): Promise<RespostaLogin> {
    const aluno = await this.procurarAluno(codigo, nome);

    if (aluno === null) {
      // Gasta o tempo de um bcrypt mesmo sem aluno, pelo mesmo motivo da
      // conta: a demora não pode dizer se o nome está na turma.
      await senhaConfere(senha, null);
      throw credenciaisInvalidas();
    }

    // SenhaHash NULL: o aluno nunca entrou (ou o professor zerou a senha).
    if (aluno.SenhaHash === null) {
      return this.primeiroAcesso(aluno, senha);
    }

    const senhaCerta = await senhaConfere(senha, aluno.SenhaHash);
    if (!senhaCerta) {
      throw credenciaisInvalidas();
    }
    // Só depois da senha certa, como na conta: o 403 confirmaria que o
    // nome está na turma.
    exigirAlunoLiberado(aluno);

    return this.respostaDoAluno(aluno);
  }

  // A linha de Alunos com esse nome, na turma desse código; null se não há.
  //
  // A comparação de Nome e de Codigo é a do banco: as duas colunas são
  // utf8mb4_unicode_ci, que ignora maiúscula e acento ("ana pires" acha
  // "Ána Pires") e espaço no fim. Comparar aqui no JavaScript daria duas
  // regras para a mesma pergunta — e o UNIQUE (ClassID, Nome) do banco,
  // que é quem impede dois nomes iguais na turma, usa a do banco.
  private procurarAluno(codigo: string, nome: string) {
    // Sem código ou sem nome não há o que procurar. Sem esta guarda,
    // Nome = '' poderia casar com uma linha vazia que nunca deveria existir.
    if (codigo === '' || nome === '') {
      return Promise.resolve(null);
    }
    return this.banco.alunos.findFirst({
      where: { Nome: nome, classesprof: { Codigo: codigo } },
      include: { classesprof: { select: { ClassID: true, NomeTurma: true, Ativa: true } } },
    });
  }

  // REGRA DO PRIMEIRO ACESSO: a senha enviada é validada e GRAVADA, e a
  // resposta leva primeiroAcesso: true. Não há senha para conferir: quem
  // chega primeiro com o código e o nome define a senha. É por isso que o
  // professor tem o "zerar senha" e o "gerar código novo".
  private async primeiroAcesso(aluno: AlunoEncontrado, senha: string): Promise<RespostaLogin> {
    // Antes de gravar qualquer coisa: turma arquivada ou aluno desativado
    // não ganha senha nova.
    exigirAlunoLiberado(aluno);

    const problema = problemaNaSenhaDoAluno(senha);
    if (problema !== null) {
      throw senhaForaDaRegra(problema);
    }

    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    // updateMany com SenhaHash: null no filtro, e não um update pelo ID:
    // se dois aparelhos fizerem o primeiro acesso do mesmo aluno ao mesmo
    // tempo, só um grava. O outro encontra 0 linhas e cai no 401, como se
    // tivesse digitado a senha errada — que, agora, é o que aconteceu.
    const gravou = await this.banco.alunos.updateMany({
      where: { ID: aluno.ID, SenhaHash: null },
      data: { SenhaHash: hash },
    });
    if (gravou.count === 0) {
      throw credenciaisInvalidas();
    }

    const resposta = await this.respostaDoAluno(aluno);
    return { ...resposta, primeiroAcesso: true };
  }

  private async respostaDoAluno(aluno: AlunoEncontrado): Promise<RespostaLogin> {
    return { token: await this.emitirToken(aluno.ID, 'aluno'), usuario: usuarioDoAluno(aluno) };
  }

  private emitirToken(id: string, tipo: TipoDeLogin): Promise<string> {
    const conteudo: ConteudoDoToken = { sub: id, tipo };
    return this.jwt.signAsync(conteudo);
  }
}

// O aluno como procurarAluno() devolve, já com a turma.
type AlunoEncontrado = NonNullable<Awaited<ReturnType<AutenticacaoService['procurarAluno']>>>;

// O mínimo de Users que a resposta precisa, com a campanha (se houver).
interface ContaComCampanha {
  ID: string;
  Nome: string;
  Email: string;
  campanhassolo: { CampanhaID: string }[];
}

// O `usuario` de conta. Um lugar só monta, para o login, o cadastro e o
// /auth/eu não divergirem no formato.
function usuarioDaConta(conta: ContaComCampanha): UsuarioConta {
  const usuario: UsuarioConta = { id: conta.ID, nome: conta.Nome, email: conta.Email, tipo: 'conta' };
  const campanha = conta.campanhassolo[0];
  if (campanha) {
    usuario.campanhaAtiva = campanha.CampanhaID;
  }
  return usuario;
}

// O `usuario` de aluno, igual no login e no /auth/eu.
function usuarioDoAluno(aluno: AlunoEncontrado): UsuarioAluno {
  return {
    id: aluno.ID,
    nome: aluno.Nome,
    tipo: 'aluno',
    turmas: [{ id: aluno.classesprof.ClassID, nome: aluno.classesprof.NomeTurma ?? '' }],
  };
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

// E-mail sem espaço nas pontas e minúsculo, como o mock e a tela fazem.
function normalizarEmail(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

// O código como o professor escreveu na lousa: o aluno pode digitar com
// espaço nas pontas ou minúsculo ("k7m2qx "). Maiúscula aqui só deixa o
// valor na forma gravada; quem garante a comparação é a collation.
function normalizarCodigo(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase();
}

// O nome sem espaço nas pontas e com os espaços repetidos do meio reduzidos
// a um — a forma em que a importação grava. "Ana  Pires" acha "Ana Pires".
function normalizarNome(valor: unknown): string {
  return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

// Compara a senha com o hash. Sem hash, compara com HASH_DE_NINGUEM para
// gastar o mesmo tempo, e responde false.
async function senhaConfere(senha: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    await bcrypt.compare(senha, HASH_DE_NINGUEM);
    return false;
  }
  return bcrypt.compare(senha, hash);
}

// Aluno desativado (Alunos.Ativo) ou turma arquivada (ClassesProf.Ativa):
// 403, com o mesmo código CONTA_INATIVA que a tela já trata.
function exigirAlunoLiberado(aluno: AlunoEncontrado): void {
  if (aluno.classesprof.Ativa === false) {
    throw new ForbiddenException({ mensagem: 'Esta turma foi arquivada.', codigo: 'CONTA_INATIVA' });
  }
  if (aluno.Ativo === false) {
    throw contaDesativada();
  }
}

// Os erros do login, no corpo que o contrato define para todo erro:
// { mensagem, codigo }. O Nest devolve o objeto passado tal como está.
function credenciaisInvalidas(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Credenciais inválidas.', codigo: 'CREDENCIAIS' });
}

function contaDesativada(): ForbiddenException {
  return new ForbiddenException({ mensagem: 'Conta desativada.', codigo: 'CONTA_INATIVA' });
}

function senhaForaDaRegra(mensagem: string): BadRequestException {
  return dadosInvalidos(mensagem);
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}

function emailEmUso(): ConflictException {
  return new ConflictException({ mensagem: 'Este e-mail já tem conta.', codigo: 'EMAIL_EM_USO' });
}

// O mesmo corpo do 401 do GuardaDoToken: para a tela, conta que sumiu
// depois do login é igual a token vencido.
function tokenInvalido(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Token inválido ou expirado.', codigo: 'TOKEN_INVALIDO' });
}
