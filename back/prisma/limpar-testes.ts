// limpar-testes.ts — apaga as contas que as suítes e o api.back.check criam
// (e tudo ligado a elas). Rodar com:  npm run limpar-testes
//
// Só contas de e-mail teste-…@teclar.dev ou solo-…@teclar.dev: os prefixos
// que os testes usam, no domínio dos testes. Um usuário de verdade que se
// cadastre como teste-joao@gmail.com não é pego. A demonstração (leo@,
// prof@, ana@) e as lições do Solo não são tocadas.
//
// Confirmação do banco-alvo, ANTES de apagar (mostra o banco e quantas
// contas vão sair):
//   --local                      só vale com o banco nesta máquina
//                                (localhost, 127.0.0.1, ::1). É o que as
//                                suítes usam no fim (test/limpar-no-fim.mjs).
//   --confirmar=<host>/<banco>   para qualquer banco, inclusive o TiDB: tem
//                                de ser exatamente o que o script mostra.
//   sem nada, num terminal       pergunta, e só segue com o <host>/<banco>
//                                digitado igual.
// Fora disso, recusa e não apaga nada.
//
// O banco é o do DATABASE_URL (o do back/.env, ou o do ambiente, que ganha).
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { configuracaoDoBanco } from '../src/banco/configuracao-do-banco.js';
import { apagarContas } from './apagar-contas.js';

const PREFIXOS = ['teste-', 'solo-'];
const DOMINIO = '@teclar.dev';
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1'];

const configuracao = configuracaoDoBanco();
const alvo = `${configuracao.host}/${configuracao.database}`;
const local = HOSTS_LOCAIS.includes(configuracao.host);

async function confirmado(): Promise<boolean> {
  const argumentos = process.argv.slice(2);
  if (argumentos.includes('--local')) {
    if (!local) {
      console.error(`--local recusado: o banco-alvo (${alvo}) não está nesta máquina. Use --confirmar=${alvo}.`);
    }
    return local;
  }
  const dado = argumentos.find((a) => a.startsWith('--confirmar='))?.slice('--confirmar='.length);
  if (dado !== undefined) {
    if (dado !== alvo) console.error(`--confirmar=${dado} não é o banco-alvo (${alvo}). Nada foi apagado.`);
    return dado === alvo;
  }
  if (!process.stdin.isTTY) {
    console.error(`Sem confirmação. Rode com --confirmar=${alvo} (ou --local, se for o banco local).`);
    return false;
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await terminal.question(`Digite ${alvo} para confirmar: `);
  terminal.close();
  return resposta.trim() === alvo;
}

const banco = new PrismaClient({ adapter: new PrismaMariaDb(configuracao) });
try {
  const contas = await banco.users.findMany({
    where: { OR: PREFIXOS.map((prefixo) => ({ AND: [{ Email: { startsWith: prefixo } }, { Email: { endsWith: DOMINIO } }] })) },
    select: { ID: true },
  });
  console.log(`limpar-testes — banco-alvo: ${alvo} (${local ? 'local' : 'REMOTO'}); contas de teste: ${contas.length}.`);
  if (contas.length === 0) {
    console.log('Nada a apagar.');
  } else if (!(await confirmado())) {
    process.exitCode = 1;
  } else {
    const apagados = await banco.$transaction((tx) => apagarContas(tx, contas.map((conta) => conta.ID)), { timeout: 120_000 });
    console.log(
      `Apagado: ${apagados.contas} conta(s), ${apagados.turmas} turma(s), ${apagados.alunos} aluno(s), ` +
        `${apagados.exercicios} exercício(s), ${apagados.sessoesEscola} sessão(ões) escola, ` +
        `${apagados.campanhas} campanha(s) e ${apagados.sessoesSolo} sessão(ões) Solo.`,
    );
  }
} finally {
  await banco.$disconnect();
}
