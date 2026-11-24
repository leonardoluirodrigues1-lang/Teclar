// A regra do grupo Autenticação (ver CONTRATO-API.md): o POST /auth/login,
// o POST /auth/cadastro e o GET /auth/eu. O logout não tem regra (ver o
// controller). Abaixo, o que vale para o login:
//
// Um login para duas tabelas:
//   conta (Users)  -> { email, senha }
//   aluno (Alunos) -> { codigo, nome, senha }
// É a presença de `codigo` no corpo que diz qual tabela procurar.
// Responde { token, usuario }. Aluno que entrou com a senha provisória vem
// com usuario.precisaTrocarSenha: true (e o /auth/eu repete isso até ele
// criar a senha dele em POST /aluno/senha).
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
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { BancoService } from '../banco/banco.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { problemaNaSenhaDaConta, problemaNoEmail, problemaNoNome } from './regras-do-cadastro.js';
import { CUSTO_BCRYPT_ALUNO, problemaNaSenhaDoAluno, provisoriaValida } from './senha-do-aluno.js';
import { TentativasDeLogin } from './tentativas-de-login.js';
import type { ConteudoDoToken, Identidade, TipoDeLogin } from './token.js';
import { dadosInvalidos } from '../dados-invalidos.js';

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
  turmas: { id: string; nome: string; codigo: string }[];
  // true enquanto o aluno não criou a senha dele (entrou pela provisória).
  precisaTrocarSenha?: true;
}

export type Usuario = UsuarioConta | UsuarioAluno;

export interface RespostaLogin {
  token: string;
  usuario: Usuario;
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
    private readonly tentativas: TentativasDeLogin,
  ) {}

  // O login com o contador de senhas erradas em volta (ver
  // tentativas-de-login.ts). A chave é IP + quem tenta entrar: numa escola
  // todos os alunos saem pelo mesmo IP, e contar só por IP bloquearia a
  // turma inteira pelos erros de um.
  entrar(corpo: CorpoDoLogin, ip: string): Promise<RespostaLogin> {
    return this.comLimite(`${ip}|${identidadeDoLogin(corpo)}`, () => this.autenticar(corpo));
  }

  // POST /auth/aluno: a entrada do aluno, com o mesmo contador do login. A
  // chave é a mesma do login de aluno (código + nome): errar aqui e lá soma
  // no mesmo minuto.
  entrarNaTurma(corpo: CorpoDoLogin, ip: string): Promise<RespostaLogin> {
    const identidade = identidadeDoLogin({ codigo: corpo?.codigo ?? '', nome: corpo?.nome });
    return this.comLimite(`${ip}|${identidade}`, () =>
      this.entrarOuMatricular(
        normalizarCodigo(corpo?.codigo),
        normalizarNome(corpo?.nome),
        String(corpo?.senha ?? '').trim(),
      ),
    );
  }

  private async comLimite(chave: string, autenticar: () => Promise<RespostaLogin>): Promise<RespostaLogin> {
    this.tentativas.conferir(chave);
    try {
      const resposta = await autenticar();
      this.tentativas.zerar(chave);
      return resposta;
    } catch (erro) {
      // Só o 401 (senha errada) é chute de senha; 400, 403, 404 e 409 não contam.
      if (erro instanceof UnauthorizedException) {
        this.tentativas.somarFalha(chave);
      }
      throw erro;
    }
  }

  // GET /auth/turmas/:codigo: o passo 1 da tela do aluno. Devolve o nome da
  // turma para ele conferir que digitou o código certo.
  async turmaPeloCodigo(codigoBruto: unknown): Promise<{ nome: string }> {
    const turma = await this.turmaAberta(normalizarCodigo(codigoBruto));
    return { nome: turma.NomeTurma ?? '' };
  }

  // A turma do código, só se existe e não está arquivada.
  private async turmaAberta(codigo: string) {
    const turma =
      codigo === ''
        ? null
        : await this.banco.classesprof.findUnique({
            where: { Codigo: codigo },
            select: { ClassID: true, NomeTurma: true, Codigo: true, Ativa: true },
          });
    if (!turma) {
      throw new NotFoundException({ mensagem: 'Não existe turma com esse código.', codigo: 'TURMA_NAO_ENCONTRADA' });
    }
    if (turma.Ativa === false) {
      throw new ForbiddenException({ mensagem: 'Esta turma foi arquivada.', codigo: 'TURMA_ARQUIVADA' });
    }
    return turma;
  }

  // Nome já na turma: é login (a mesma conferência do POST /auth/login).
  // Nome novo: é o primeiro acesso, e a matrícula nasce com a senha que ele
  // escolheu. Aqui o nome na turma deixa de ser segredo (a resposta muda
  // entre os dois casos): é o preço de o aluno se matricular sozinho.
  private async entrarOuMatricular(codigo: string, nome: string, senha: string): Promise<RespostaLogin> {
    const turma = await this.turmaAberta(codigo);
    const aluno = await this.procurarAluno(codigo, nome);
    if (aluno !== null) {
      return this.conferirAluno(aluno, senha, senhaIncorreta);
    }

    const problema = problemaNoNome(nome) ?? problemaNaSenhaDoAluno(senha);
    if (problema !== null) {
      throw dadosInvalidos(problema);
    }
    // bcrypt fora da transação: não segura a conexão durante o hash.
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    let novo;
    try {
      // O ID e a matrícula nascem juntos: se o nome colidir (outro aparelho
      // matriculou o mesmo nome agora), a transação desfaz o ID.
      novo = await this.banco.$transaction(async (tx) => {
        const id = randomUUID();
        await tx.alunos.create({ data: { ID: id } });
        return tx.alunosturmas.create({ data: { ClassID: turma.ClassID, AlunoID: id, Nome: nome, SenhaHash: hash } });
      });
    } catch (erro) {
      // P2002: o UNIQUE (ClassID, Nome) recusou.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException({
          mensagem: 'Já tem alguém com esse nome nesta turma. Se não é você, use também seu sobrenome.',
          codigo: 'NOME_EM_USO',
        });
      }
      throw erro;
    }
    return this.respostaDoAluno({ ...novo, classesprof: turma });
  }

  private async autenticar(corpo: CorpoDoLogin): Promise<RespostaLogin> {
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

  // Conta (Users)

  private async entrarComoConta(email: string, senha: string): Promise<RespostaLogin> {
    const conta = await this.banco.users.findUnique({
      where: { Email: email },
      // A campanha do Solo vem junto, pela relação users -> campanhassolo.
      // É uma só (UNIQUE em CampanhasSolo.JogadorID, banco v9), ou null.
      include: { campanhassolo: { select: { CampanhaID: true } } },
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

  // Cadastro (só conta: aluno não se cadastra, é importado pelo professor)

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
    const usuario = usuarioDaConta({ ...conta, campanhassolo: null });
    return { token: await this.emitirToken(conta.ID, 'conta'), usuario };
  }

  // Quem sou eu (GET /auth/eu)

  // O dono do token, lido de novo do banco, na mesma forma do login. Lê do
  // banco, e não só do token, porque o token guarda só id e tipo — e
  // porque a conta pode ter sido desativada depois do login.
  quemSouEu(identidade: Identidade): Promise<Usuario> {
    if (identidade.tipo === 'aluno') {
      return this.alunoDoToken(identidade.id);
    }
    return this.contaDoToken(identidade.id);
  }

  // --- Configurações > Conta (perfil.controller.ts) ---------------------------

  // PATCH /conta: o nome da conta, com a regra e a forma do cadastro.
  async renomearConta(identidade: Identidade, corpo: { nome?: unknown }): Promise<Usuario> {
    const id = soConta(identidade);
    const nome = normalizarNome(corpo?.nome);
    const problema = problemaNoNome(nome);
    if (problema !== null) {
      throw dadosInvalidos(problema);
    }
    await this.banco.users.update({ where: { ID: id }, data: { Nome: nome } });
    return this.contaDoToken(id);
  }

  // POST /conta/senha: pede a senha atual. A nova segue a regra do cadastro
  // (8+, letra e número) e é gravada sem aparar, como lá.
  async trocarSenhaDaConta(identidade: Identidade, corpo: { senhaAtual?: unknown; novaSenha?: unknown }): Promise<void> {
    const id = soConta(identidade);
    const nova = String(corpo?.novaSenha ?? '');
    const problema = problemaNaSenhaDaConta(nova);
    if (problema !== null) {
      throw dadosInvalidos(problema);
    }
    const conta = await this.banco.users.findUnique({ where: { ID: id }, select: { SenhaHash: true } });
    await this.conferirSenhaAtual(`troca|conta|${id}`, String(corpo?.senhaAtual ?? ''), conta?.SenhaHash ?? null);
    await this.banco.users.update({ where: { ID: id }, data: { SenhaHash: await bcrypt.hash(nova, CUSTO_BCRYPT) } });
  }

  // PUT /aluno/senha: o aluno que JÁ tem senha troca a da matrícula dele,
  // com a senha atual e a regra da senha do aluno (6 a 20, letra e número,
  // aparada). A provisória que restar deixa de valer.
  async trocarSenhaDoAluno(identidade: Identidade, corpo: { senhaAtual?: unknown; novaSenha?: unknown }): Promise<void> {
    if (identidade.tipo !== 'aluno') {
      throw new ForbiddenException({ mensagem: 'Rota só para alunos.', codigo: 'TIPO_INVALIDO' });
    }
    const nova = String(corpo?.novaSenha ?? '').trim();
    const problema = problemaNaSenhaDoAluno(nova);
    if (problema !== null) {
      throw dadosInvalidos(problema);
    }
    const aluno = await this.banco.alunosturmas.findUnique({ where: { AlunoID: identidade.id }, select: { SenhaHash: true } });
    await this.conferirSenhaAtual(`troca|aluno|${identidade.id}`, String(corpo?.senhaAtual ?? '').trim(), aluno?.SenhaHash ?? null);
    await this.banco.alunosturmas.update({
      where: { AlunoID: identidade.id },
      data: { SenhaHash: await bcrypt.hash(nova, CUSTO_BCRYPT_ALUNO), SenhaProvisoriaHash: null, SenhaProvisoriaExpira: null },
    });
  }

  // A senha atual errada é 400, e não 401: o 401 derruba a sessão na tela.
  // Conta no mesmo contador do login (5 erradas = 429 por um tempo), por
  // quem está trocando.
  private async conferirSenhaAtual(chave: string, senhaAtual: string, hash: string | null): Promise<void> {
    this.tentativas.conferir(chave);
    if (!(await senhaConfere(senhaAtual, hash))) {
      this.tentativas.somarFalha(chave);
      throw new BadRequestException({ mensagem: 'A senha atual não confere.', codigo: 'SENHA_ATUAL_INCORRETA' });
    }
    this.tentativas.zerar(chave);
  }

  private async contaDoToken(id: string): Promise<UsuarioConta> {
    const conta = await this.banco.users.findUnique({
      where: { ID: id },
      include: { campanhassolo: { select: { CampanhaID: true } } },
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
    // v10: o id do token é o AlunoID da matrícula (alunosturmas).
    const aluno = await this.banco.alunosturmas.findUnique({
      where: { AlunoID: id },
      include: { classesprof: { select: { ClassID: true, NomeTurma: true, Codigo: true, Ativa: true } } },
    });
    // Mesmo raciocínio da conta: aluno removido, desativado, ou com a
    // turma arquivada depois do login perde a sessão.
    if (!aluno || aluno.Ativo === false || aluno.classesprof.Ativa === false) {
      throw tokenInvalido();
    }
    return usuarioDoAluno(aluno);
  }

  // Aluno (Alunos, dentro de uma turma)

  private async entrarComoAluno(codigo: string, nome: string, senha: string): Promise<RespostaLogin> {
    const aluno = await this.procurarAluno(codigo, nome);

    if (aluno === null) {
      // Gasta o tempo de um bcrypt mesmo sem aluno, pelo mesmo motivo da
      // conta: a demora não pode dizer se o nome está na turma.
      await senhaConfere(senha, null);
      throw credenciaisInvalidas();
    }
    return this.conferirAluno(aluno, senha, credenciaisInvalidas);
  }

  // O aluno achado: confere a senha (ou a provisória) e entra. `recusa` é o
  // 401 de quem chamou: o login não diz o que errou; a entrada diz.
  private async conferirAluno(
    aluno: AlunoEncontrado,
    senha: string,
    recusa: () => UnauthorizedException,
  ): Promise<RespostaLogin> {
    // SenhaHash NULL: o aluno ainda não criou a senha dele. Só a provisória
    // do professor, dentro da validade, abre o login — nunca uma senha
    // qualquer.
    if (aluno.SenhaHash === null) {
      return this.entrarComProvisoria(aluno, senha, recusa);
    }

    const senhaCerta = await senhaConfere(senha, aluno.SenhaHash);
    if (!senhaCerta) {
      throw recusa();
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
    return this.banco.alunosturmas.findFirst({
      where: { Nome: nome, classesprof: { Codigo: codigo } },
      include: { classesprof: { select: { ClassID: true, NomeTurma: true, Codigo: true, Ativa: true } } },
    });
  }

  // A senha provisória (ver senha-do-aluno.ts): confere com o hash dela e,
  // se bate e está no prazo, APAGA a provisória (uso único) e entra com
  // precisaTrocarSenha. Sem provisória válida, gasta o tempo do bcrypt e
  // responde o mesmo 401 de senha errada.
  private async entrarComProvisoria(
    aluno: AlunoEncontrado,
    senha: string,
    recusa: () => UnauthorizedException,
  ): Promise<RespostaLogin> {
    const valida = provisoriaValida(aluno.SenhaProvisoriaHash, aluno.SenhaProvisoriaExpira);
    const senhaCerta = await senhaConfere(senha, valida ? aluno.SenhaProvisoriaHash : null);
    if (!senhaCerta) {
      throw recusa();
    }
    exigirAlunoLiberado(aluno);

    // updateMany com o hash no filtro: dois aparelhos com a mesma
    // provisória ao mesmo tempo, só um a consome; o outro cai no 401.
    const consumiu = await this.banco.alunosturmas.updateMany({
      where: { AlunoID: aluno.AlunoID, SenhaHash: null, SenhaProvisoriaHash: aluno.SenhaProvisoriaHash },
      data: { SenhaProvisoriaHash: null, SenhaProvisoriaExpira: null },
    });
    if (consumiu.count !== 1) {
      throw recusa();
    }
    return this.respostaDoAluno(aluno);
  }

  private async respostaDoAluno(aluno: AlunoEncontrado): Promise<RespostaLogin> {
    return { token: await this.emitirToken(aluno.AlunoID, 'aluno'), usuario: usuarioDoAluno(aluno) };
  }

  private emitirToken(id: string, tipo: TipoDeLogin): Promise<string> {
    const conteudo: ConteudoDoToken = { sub: id, tipo };
    return this.jwt.signAsync(conteudo);
  }
}

// O aluno como procurarAluno() devolve, já com a turma.
type AlunoEncontrado = NonNullable<Awaited<ReturnType<AutenticacaoService['procurarAluno']>>>;

// O mínimo de Users que a resposta precisa, com a campanha (null sem).
interface ContaComCampanha {
  ID: string;
  Nome: string;
  Email: string;
  campanhassolo: { CampanhaID: string } | null;
}

// O `usuario` de conta. Um lugar só monta, para o login, o cadastro e o
// /auth/eu não divergirem no formato.
function usuarioDaConta(conta: ContaComCampanha): UsuarioConta {
  const usuario: UsuarioConta = { id: conta.ID, nome: conta.Nome, email: conta.Email, tipo: 'conta' };
  const campanha = conta.campanhassolo;
  if (campanha) {
    usuario.campanhaAtiva = campanha.CampanhaID;
  }
  return usuario;
}

// O `usuario` de aluno, igual no login e no /auth/eu.
function usuarioDoAluno(aluno: AlunoEncontrado): UsuarioAluno {
  const usuario: UsuarioAluno = {
    id: aluno.AlunoID,
    nome: aluno.Nome,
    tipo: 'aluno',
    turmas: [{ id: aluno.classesprof.ClassID, nome: aluno.classesprof.NomeTurma ?? '', codigo: aluno.classesprof.Codigo }],
  };
  // Sem senha própria: entrou pela provisória e ainda não criou a dele.
  if (aluno.SenhaHash === null) {
    usuario.precisaTrocarSenha = true;
  }
  return usuario;
}

// Funções soltas: não dependem do banco nem do Nest.

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

// Quem o corpo do login diz ser, decidido como no autenticar (codigo
// presente = aluno). O nome vai também sem maiúscula e sem acento, como a
// collation do banco compara: senão "ana pires" e "Ana Pires" seriam
// contadores diferentes para a mesma aluna.
function identidadeDoLogin(corpo: CorpoDoLogin): string {
  if (corpo?.codigo !== undefined) {
    const nome = normalizarNome(corpo.nome).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return `aluno|${normalizarCodigo(corpo.codigo)}|${nome}`;
  }
  return `conta|${normalizarEmail(corpo?.email)}`;
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

// O 401 da entrada do aluno (POST /auth/aluno): lá o nome já existe, então
// dizer que o errado é a senha não entrega nada novo.
function senhaIncorreta(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Senha incorreta.', codigo: 'CREDENCIAIS' });
}

// As rotas de Configurações > Conta são só da conta (o aluno não tem e-mail nem nome próprio para trocar).
function soConta(identidade: Identidade): string {
  if (identidade.tipo !== 'conta') {
    throw new ForbiddenException({ mensagem: 'Rota só para contas.', codigo: 'TIPO_INVALIDO' });
  }
  return identidade.id;
}

function contaDesativada(): ForbiddenException {
  return new ForbiddenException({ mensagem: 'Conta desativada.', codigo: 'CONTA_INATIVA' });
}


function emailEmUso(): ConflictException {
  return new ConflictException({ mensagem: 'Este e-mail já tem conta.', codigo: 'EMAIL_EM_USO' });
}

// O mesmo corpo do 401 do GuardaDoToken: para a tela, conta que sumiu
// depois do login é igual a token vencido.
function tokenInvalido(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Token inválido ou expirado.', codigo: 'TOKEN_INVALIDO' });
}
