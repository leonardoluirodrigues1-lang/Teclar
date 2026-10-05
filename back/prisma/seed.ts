// seed.ts
// Dados de teste para o teclardb. Rodar com:  npm run seed
//
// ATENÇÃO: APAGA tudo das tabelas que ele preenche (contas, alunos, turmas,
// exercícios, sessões) antes de inserir. É para o banco de desenvolvimento.
// Categorias e Configuracoes ficam como estão: quem as semeia é o
// DB_Teclar_v7.sql.
//
// Idempotente: rodar duas vezes dá o mesmo banco, porque cada rodada
// começa limpando e os ids são fixos ('u-1', 'turma-1'...), não gerados.
//
// Os dados são os do mock do front (js/nucleo/mocks.ts), para a tela com
// mock e a tela com o back mostrarem a mesma coisa. As 76 lições do Solo
// nem são copiadas: vêm do mesmo arquivo que o mock lê (js/nucleo/licoes.ts).
//
// As credenciais estão no README do back.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { configuracaoDoBanco } from '../src/banco/configuracao-do-banco.js';
import { LICOES, montarLicao } from '../../js/nucleo/licoes.js';

// O tipo do "tx" de uma transação: o client sem os métodos de conexão.
type Transacao = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Custo do bcrypt (2^10 rodadas): o padrão da biblioteca. O custo fica
// gravado dentro do hash, então o login compara sem precisar saber dele.
const CUSTO_BCRYPT = 10;

const SENHA_DAS_CONTAS = 'senha123';
const SENHA_DOS_ALUNOS = 'Aluno#2025';

// Data de "n dias atrás", para as sessões recentes continuarem recentes em
// qualquer dia que o seed rodar (o relatório conta quem treinou na semana).
function diasAtras(dias: number): Date {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

// ============================================================================
// 1. Limpeza
// ============================================================================

// Filhas antes das mães: uma linha não pode sumir enquanto outra aponta
// para ela. As FKs têm ON DELETE CASCADE e apagar só Users já levaria quase
// tudo junto — mas a ordem explícita deixa à vista o que depende do quê, e
// não depende de alguém lembrar que o CASCADE está lá.
async function limparTabelas(tx: Transacao): Promise<void> {
  await tx.sessionsprof.deleteMany();
  await tx.sessionssolo.deleteMany();
  await tx.atribuicoesprof.deleteMany();
  await tx.classmembers.deleteMany();
  await tx.exerciciosprof.deleteMany();
  await tx.classesprof.deleteMany();
  await tx.alunos.deleteMany();
  await tx.campanhassolo.deleteMany();
  await tx.exerciciossolo.deleteMany();
  await tx.users.deleteMany();
}

// ============================================================================
// 2. Contas (Users) e Solo
// ============================================================================

// u-1 é a conta do Solo e u-2 a do professor — os mesmos ids, nomes e
// e-mails do mock. A diferença está só no uso: a tabela não tem perfil.
async function inserirContas(tx: Transacao, senhaHash: string): Promise<void> {
  await tx.users.createMany({
    data: [
      { ID: 'u-1', Nome: 'Leonardo', Email: 'leo@teclar.dev', SenhaHash: senhaHash },
      { ID: 'u-2', Nome: 'Henrique Lima', Email: 'prof@teclar.dev', SenhaHash: senhaHash },
    ],
  });
}

// A campanha nasce no nível 1 com 0 XP, como a do botão "Começar" do lobby.
// O mock dá à camp-1 nível 4 e 669 XP, mas esse XP é a soma de dez sessões
// Solo que o seed não cria; gravar 669 sem elas faria a campanha e o
// histórico contarem histórias diferentes.
async function inserirSolo(tx: Transacao): Promise<void> {
  await tx.campanhassolo.create({
    data: { CampanhaID: 'camp-1', JogadorID: 'u-1', NivelAtual: 1, XPTotal: 0 },
  });

  const licoes = LICOES.map(montarLicao);
  await tx.exerciciossolo.createMany({
    data: licoes.map((licao) => ({
      ExerciseID: licao.exerciseId,
      Titulo: licao.titulo,
      Texto: licao.texto,
      Dificuldade: licao.dificuldade,
      Tempo_Limite_Segundos: licao.tempoLimiteSegundos,
      Nivel: licao.nivel,
      Repeticoes: licao.repeticoes,
      Ordem: licao.ordem,
    })),
  });
}

// ============================================================================
// 3. Escola: exercícios, turmas, alunos, convites e sessões
// ============================================================================

// Os exercícios do professor u-2 no mock, com os mesmos ids e textos.
const EXERCICIOS_DO_PROFESSOR = [
  {
    id: 'ex-prof-1',
    titulo: 'Acentuação em foco',
    dificuldade: 'medio',
    tempo: 120,
    texto:
      'À noite, o céu límpido de setembro revelava constelações que só a avó reconhecia. ' +
      '"É a estação das águas", dizia ela, com convicção serena, enquanto o café esfriava ' +
      'sobre a mesa. Ninguém ousava contestá-la: três gerações já decoraram aquela lição.',
  },
  {
    id: 'ex-prof-2',
    titulo: 'Números do cotidiano',
    dificuldade: 'medio',
    tempo: 0,
    texto:
      'O pedido #4837 saiu por R$ 1.299,90 com 15% de desconto no dia 07/02/2026 às 14:35. ' +
      'Confirme em suporte@teclar.dev ou pelo ramal 210 (opção 3). Itens: 12 + 4 brindes.',
  },
  {
    id: 'ex-prof-3',
    titulo: 'Funções em JavaScript',
    dificuldade: 'dificil',
    tempo: 180,
    texto:
      'const media = (valores) => valores.length === 0 ? 0 : ' +
      'valores.reduce((total, n) => total + n, 0) / valores.length;',
  },
  {
    id: 'ex-prof-4',
    titulo: 'Fileira de cima',
    dificuldade: 'facil',
    tempo: 0,
    texto: 'Quero que o tio traga o pote de pirulito e o retrato do rei que tirou o tapete torto.',
  },
  {
    id: 'ex-prof-5',
    titulo: 'Frase curta',
    dificuldade: 'facil',
    tempo: 45,
    texto: 'O rato roeu a rolha do garrafão do rei da Rússia enquanto o gato observava da janela.',
  },
  {
    id: 'ex-prof-7',
    titulo: 'Linha-guia',
    dificuldade: 'facil',
    tempo: 180,
    texto: 'Asdf jklç, a linha do meio guia os dedos: sem olhar, eles voltam sempre para casa.',
  },
  {
    id: 'ex-prof-8',
    titulo: 'Fileira de baixo',
    dificuldade: 'facil',
    tempo: 90,
    texto: 'Zebra, vaca e cobra: a fileira de baixo pede calma, um dedo de cada vez.',
  },
  {
    id: 'ex-prof-9',
    titulo: 'Pontuação',
    dificuldade: 'medio',
    tempo: 120,
    texto: 'Vírgula respira, ponto encerra; dois-pontos anunciam: e a pergunta termina assim?',
  },
  {
    id: 'ex-prof-10',
    titulo: 'Maiúsculas',
    dificuldade: 'medio',
    tempo: 0,
    texto: 'Em Belo Horizonte, Ana e Pedro leram O Pequeno Príncipe numa tarde de Março.',
  },
  {
    id: 'ex-prof-11',
    titulo: 'Datas e horários',
    dificuldade: 'dificil',
    tempo: 150,
    texto: 'A prova é dia 12/06, às 7h45; a entrega vai até 19/06, às 23h59, sem atraso.',
  },
  {
    id: 'ex-prof-12',
    titulo: 'Parágrafo final',
    dificuldade: 'dificil',
    tempo: 0,
    texto:
      'Digitar bem é ritmo antes de pressa: olhos no texto, dedos em casa, e a velocidade chega sozinha com o tempo.',
  },
] as const;

async function inserirExercicios(tx: Transacao): Promise<void> {
  await tx.exerciciosprof.createMany({
    data: EXERCICIOS_DO_PROFESSOR.map((ex) => ({
      ExerciseID: ex.id,
      ProfessorID: 'u-2',
      Titulo: ex.titulo,
      Texto: ex.texto,
      Dificuldade: ex.dificuldade,
      Tempo_Limite_Segundos: ex.tempo,
    })),
  });
}

// As duas primeiras turmas do mock. Ano e Semestre preenchidos (nenhuma
// rota grava, mas o seed pode) para o "2026 · 1º semestre" ter de onde vir.
async function inserirTurmas(tx: Transacao): Promise<void> {
  await tx.classesprof.createMany({
    data: [
      {
        ClassID: 'turma-1',
        ProfessorID: 'u-2',
        NomeTurma: '9º Ano A — Manhã',
        Ano: 2026,
        Semestre: 1,
        CapaSemente: 7001,
        Data_Criacao: new Date('2026-02-01'),
      },
      {
        ClassID: 'turma-2',
        ProfessorID: 'u-2',
        NomeTurma: 'Reforço de digitação',
        Ano: 2026,
        Semestre: 1,
        CapaSemente: 7138,
        Data_Criacao: new Date('2026-02-10'),
      },
    ],
  });

  // A turma-1 recebe 8 exercícios (a trilha longa, que serpenteia) e a
  // turma-2, 2. Prazo fica NULL: nenhuma rota grava prazo ainda.
  await tx.atribuicoesprof.createMany({
    data: [
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-1', Data_Atribuicao: new Date('2026-02-03') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-2', Data_Atribuicao: new Date('2026-02-17') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-7', Data_Atribuicao: new Date('2026-03-20') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-8', Data_Atribuicao: new Date('2026-03-24') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-9', Data_Atribuicao: new Date('2026-03-27') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-10', Data_Atribuicao: new Date('2026-03-31') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-11', Data_Atribuicao: new Date('2026-04-03') },
      { ClassID: 'turma-1', ExerciseID: 'ex-prof-12', Data_Atribuicao: new Date('2026-04-07') },
      { ClassID: 'turma-2', ExerciseID: 'ex-prof-3', Data_Atribuicao: new Date('2026-02-11') },
      { ClassID: 'turma-2', ExerciseID: 'ex-prof-5', Data_Atribuicao: new Date('2026-03-04') },
    ],
  });
}

// Três alunos do mock. Não estão ligados a conta (UserID NULL, o caso do
// "aluno antigo"), então o nome vem de Alunos.Nome. RP2025044 fica sem
// nome de propósito: é o caminho em que a tela mostra o RP.
async function inserirAlunos(tx: Transacao, senhaHash: string): Promise<void> {
  await tx.alunos.createMany({
    data: [
      { ID: 'RP2025043', Nome: 'Ana Pires', SenhaHash: senhaHash },
      { ID: 'RP2025044', Nome: null, SenhaHash: senhaHash },
      { ID: 'RP2025049', Nome: 'Marina Duarte Alves', SenhaHash: senhaHash },
    ],
  });
}

// Os três estados de ClassMembers:
//   ativo      aceitou: Data_Matricula é a data do aceite
//   convidado  ainda não respondeu: Data_Matricula NULL
//   recusado   respondeu que não: Data_Matricula NULL (nunca entrou)
// Na turma-1 os três estão ativos (é a turma dos relatórios); na turma-2
// aparecem os outros dois estados.
async function inserirMatriculas(tx: Transacao): Promise<void> {
  await tx.classmembers.createMany({
    data: [
      {
        ID: 'RP2025043',
        ClassID: 'turma-1',
        Status: 'ativo',
        Data_Convite: new Date('2026-02-01'),
        Data_Matricula: new Date('2026-02-01'),
      },
      {
        ID: 'RP2025044',
        ClassID: 'turma-1',
        Status: 'ativo',
        Data_Convite: new Date('2026-02-01'),
        Data_Matricula: new Date('2026-02-01'),
      },
      {
        ID: 'RP2025049',
        ClassID: 'turma-1',
        Status: 'ativo',
        Data_Convite: new Date('2026-02-04'),
        Data_Matricula: new Date('2026-02-05'),
      },
      {
        ID: 'RP2025043',
        ClassID: 'turma-2',
        Status: 'ativo',
        Data_Convite: new Date('2026-02-11'),
        Data_Matricula: new Date('2026-02-12'),
      },
      { ID: 'RP2025044', ClassID: 'turma-2', Status: 'convidado', Data_Convite: diasAtras(2), Data_Matricula: null },
      { ID: 'RP2025049', ClassID: 'turma-2', Status: 'recusado', Data_Convite: diasAtras(10), Data_Matricula: null },
    ],
  });
}

// Sessões tiradas do mock (mesmos ids e números). Cobrem o que os
// relatórios precisam mostrar: concluídas, uma que estourou o tempo em cada
// turma (Concluida = false) e precisão baixa (RP2025049).
async function inserirSessoes(tx: Transacao): Promise<void> {
  await tx.sessionsprof.createMany({
    data: [
      // turma-1
      sessao('ses-1', 'RP2025043', 'ex-prof-1', 'turma-1', 40, 95, 76, 4, 58, true, new Date('2026-02-18T14:10:00Z')),
      sessao('ses-2', 'RP2025043', 'ex-prof-2', 'turma-1', 36, 92, 80, 7, 61, true, new Date('2026-02-19T09:30:00Z')),
      sessao('ses-4', 'RP2025044', 'ex-prof-2', 'turma-1', 29, 88, 81, 11, 96, true, diasAtras(6)),
      sessao('ses-5', 'RP2025044', 'ex-prof-1', 'turma-1', 24, 81, 77, 18, 120, false, diasAtras(3)),
      sessao('ses-6', 'RP2025049', 'ex-prof-1', 'turma-1', 33, 79, 79, 21, 104, true, diasAtras(2)),
      sessao('ses-7', 'RP2025049', 'ex-prof-2', 'turma-1', 30, 76, 86, 27, 131, true, diasAtras(9)),
      // turma-2
      sessao('ses-8', 'RP2025043', 'ex-prof-3', 'turma-2', 28, 84, 126, 24, 178, true, diasAtras(26)),
      sessao('ses-9', 'RP2025043', 'ex-prof-3', 'turma-2', 31, 86, 129, 21, 165, true, diasAtras(22)),
      sessao('ses-10', 'RP2025043', 'ex-prof-5', 'turma-2', 30, 82, 41, 9, 45, false, diasAtras(18)),
    ],
  });
}

// Uma linha de SessionsProf. Função para a lista acima caber numa linha por
// sessão; os parâmetros estão na ordem em que a tela de resultado os lê.
function sessao(
  id: string,
  alunoId: string,
  exercicioId: string,
  turmaId: string,
  wpm: number,
  precisao: number,
  acertos: number,
  erros: number,
  segundos: number,
  concluida: boolean,
  data: Date,
) {
  return {
    ID: id,
    AlunoID: alunoId,
    ExerciseID: exercicioId,
    ClassID: turmaId,
    WPM: wpm,
    Precisao: precisao,
    Acertos: acertos,
    Erros: erros,
    Tempo_Gasto_Segundos: segundos,
    Concluida: concluida,
    Data_Sessao: data,
  };
}

// ============================================================================
// 4. Execução
// ============================================================================

async function semear(): Promise<void> {
  const banco = new PrismaClient({ adapter: new PrismaMariaDb(configuracaoDoBanco()) });

  // Os hashes são calculados ANTES da transação: o bcrypt é lento de
  // propósito, e a transação deve ficar aberta o mínimo possível.
  const hashDasContas = await bcrypt.hash(SENHA_DAS_CONTAS, CUSTO_BCRYPT);
  const hashDosAlunos = await bcrypt.hash(SENHA_DOS_ALUNOS, CUSTO_BCRYPT);

  try {
    // Uma transação só: se qualquer insert falhar, a limpeza também é
    // desfeita, e o banco não fica pela metade.
    await banco.$transaction(
      async (tx) => {
        await limparTabelas(tx);
        await inserirContas(tx, hashDasContas);
        await inserirSolo(tx);
        await inserirExercicios(tx);
        await inserirTurmas(tx);
        await inserirAlunos(tx, hashDosAlunos);
        await inserirMatriculas(tx);
        await inserirSessoes(tx);
      },
      // O padrão do Prisma é 5 s; 76 lições + o resto passam disso numa
      // máquina lenta.
      { timeout: 30_000 },
    );
    console.log('Seed concluído. Credenciais no README do back.');
  } finally {
    await banco.$disconnect();
  }
}

await semear();
