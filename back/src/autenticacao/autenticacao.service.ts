// autenticacao.service.ts
// A regra do POST /auth/login (ver CONTRATO-API.md, grupo Autenticação).
//
// Um login para duas tabelas:
//   conta (Users)  -> { email, senha }
//   aluno (Alunos) -> { perfil: "Aluno", rp, senha }
// Responde { token, usuario }. Credencial errada é sempre o mesmo 401
// CREDENCIAIS, exista a conta ou não: dizer "e-mail não cadastrado"
// entregaria quem tem conta no sistema a quem perguntasse.
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { BancoService } from '../banco/banco.service.js';
import type { ConteudoDoToken, TipoDeLogin } from './token.js';

// O corpo como chega. Tudo unknown: vem da rede, e nada garante que a tela
// (ou quem chamar com curl) mandou texto.
export interface CorpoDoLogin {
  email?: unknown;
  rp?: unknown;
  senha?: unknown;
  perfil?: unknown;
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
  nome: string | null;
  tipo: 'aluno';
  turmas: { id: string; nome: string }[];
}

export interface RespostaLogin {
  token: string;
  usuario: UsuarioConta | UsuarioAluno;
}

// Um hash bcrypt de verdade, de uma senha que ninguém sabe. Quando o e-mail
// ou o RP não existem, a senha é comparada com ele mesmo assim: sem isso o
// "não existe" responderia em 1 ms e o "senha errada" em ~70 ms (o tempo do
// bcrypt), e a demora denunciaria quem tem conta.
const HASH_DE_NINGUEM = bcrypt.hashSync('nenhuma-senha-confere-com-este-hash', 10);

@Injectable()
export class AutenticacaoService {
  constructor(
    private readonly banco: BancoService,
    private readonly jwt: JwtService,
  ) {}

  async entrar(corpo: CorpoDoLogin): Promise<RespostaLogin> {
    // As pontas da senha são aparadas antes de comparar: senha colada
    // costuma trazer espaço ou quebra de linha no fim. É seguro porque o
    // cadastro recusa senha com espaço nas pontas (regra do contrato).
    const senha = String(corpo?.senha ?? '').trim();

    if (corpo?.perfil === 'Aluno') {
      return this.entrarComoAluno(normalizarRp(corpo.rp), senha);
    }
    return this.entrarComoConta(normalizarEmail(corpo?.email), senha);
  }

  private async entrarComoConta(email: string, senha: string): Promise<RespostaLogin> {
    const conta = await this.banco.users.findUnique({ where: { Email: email } });

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

    const usuario: UsuarioConta = { id: conta.ID, nome: conta.Nome, email: conta.Email, tipo: 'conta' };
    const campanha = await this.banco.campanhassolo.findFirst({ where: { JogadorID: conta.ID } });
    if (campanha) {
      usuario.campanhaAtiva = campanha.CampanhaID;
    }

    return { token: await this.emitirToken(conta.ID, 'conta'), usuario };
  }

  private async entrarComoAluno(rp: string, senha: string): Promise<RespostaLogin> {
    const aluno = await this.banco.alunos.findUnique({ where: { ID: rp } });

    const senhaCerta = await senhaConfere(senha, aluno?.SenhaHash ?? null);
    if (!aluno || !senhaCerta) {
      throw credenciaisInvalidas();
    }
    if (aluno.Ativo === false) {
      throw contaDesativada();
    }

    const usuario: UsuarioAluno = {
      id: aluno.ID,
      nome: await this.nomeDoAluno(aluno.UserID, aluno.Nome),
      tipo: 'aluno',
      turmas: await this.turmasDoAluno(aluno.ID),
    };

    return { token: await this.emitirToken(aluno.ID, 'aluno'), usuario };
  }

  // O nome do aluno é o da conta dona (Alunos.UserID -> Users.Nome). Aluno
  // antigo, sem conta ligada, usa a coluna Alunos.Nome. Sem nenhum dos
  // dois vai null, e a tela mostra o RP — nunca um nome inventado.
  private async nomeDoAluno(userId: string | null, nomeEmAlunos: string | null): Promise<string | null> {
    if (userId) {
      const dona = await this.banco.users.findUnique({ where: { ID: userId } });
      if (dona) {
        return dona.Nome;
      }
    }
    return nomeEmAlunos;
  }

  // As turmas em que o aluno está ATIVO (aceitou o convite) e que não foram
  // arquivadas — as mesmas que GET /aluno/salas mostra. Convidado ou
  // recusado ainda não é aluno da turma.
  // São duas consultas porque o schema do Prisma veio do db pull sem as
  // relações entre as tabelas (ver o README do back).
  private async turmasDoAluno(rp: string): Promise<{ id: string; nome: string }[]> {
    const matriculas = await this.banco.classmembers.findMany({
      where: { ID: rp, Status: 'ativo' },
      orderBy: { Data_Matricula: 'asc' }, // na ordem em que ele entrou
    });
    const ids = matriculas.map((m) => m.ClassID);

    const turmas = await this.banco.classesprof.findMany({
      where: { ClassID: { in: ids }, Ativa: true },
    });

    // O findMany não garante ordem; esta volta à ordem das matrículas.
    return ids
      .map((id) => turmas.find((t) => t.ClassID === id))
      .filter((turma) => turma !== undefined)
      .map((turma) => ({ id: turma.ClassID, nome: turma.NomeTurma ?? '' }));
  }

  private emitirToken(id: string, tipo: TipoDeLogin): Promise<string> {
    const conteudo: ConteudoDoToken = { sub: id, tipo };
    return this.jwt.signAsync(conteudo);
  }
}

// ============================================================================
// Funções soltas: não dependem do banco nem do Nest.
// ============================================================================

// E-mail sem espaço nas pontas e minúsculo, como o mock e a tela fazem.
function normalizarEmail(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

// O RP aceita espaço e minúscula ("rp 2025043"): o contrato manda o back
// normalizar antes de procurar.
function normalizarRp(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, '').toUpperCase();
}

// Compara a senha com o hash. Sem hash (conta não existe, ou só entra pelo
// Google), compara com HASH_DE_NINGUEM para gastar o mesmo tempo, e
// responde false.
async function senhaConfere(senha: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    await bcrypt.compare(senha, HASH_DE_NINGUEM);
    return false;
  }
  return bcrypt.compare(senha, hash);
}

// Os dois erros do login, no corpo que o contrato define para todo erro:
// { mensagem, codigo }. O Nest devolve o objeto passado tal como está.
function credenciaisInvalidas(): UnauthorizedException {
  return new UnauthorizedException({ mensagem: 'Credenciais inválidas.', codigo: 'CREDENCIAIS' });
}

function contaDesativada(): ForbiddenException {
  return new ForbiddenException({ mensagem: 'Conta desativada.', codigo: 'CONTA_INATIVA' });
}
