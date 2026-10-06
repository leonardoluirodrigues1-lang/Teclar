// seed.ts
// Dados de teste para o teclardb. Rodar com:  npm run seed
//
// ATENÇÃO: APAGA tudo das tabelas que ele preenche (contas, alunos, turmas,
// exercícios, sessões) antes de inserir. É para o banco de desenvolvimento.
// Categorias e Configuracoes ficam como estão: quem as semeia é o
// DB_Teclar_v8.sql.
//
// Idempotente: rodar duas vezes dá o mesmo banco, porque cada rodada
// começa limpando e os ids são fixos ('u-1', 'turma-1'...), não gerados.
//
// Os dados são os do mock do front (js/nucleo/mocks.ts): os mesmos ids,
// códigos de turma, nomes e senhas, para a tela com mock e a tela com o
// back contarem a mesma história. As 76 lições do Solo nem são copiadas:
// vêm do mesmo arquivo que o mock lê (js/nucleo/licoes.ts).
//
// O aluno segue o banco v8: nasce DENTRO de uma turma (Alunos.ClassID),
// sem RP e sem conta, e entra com o código da turma, o nome e a senha.
// SenhaHash NULL é o aluno que ainda não fez o primeiro acesso.
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

// As senhas dos dados de teste, as mesmas do mock. A dos alunos segue a
// regra da senha de aluno (4 a 20 caracteres), como se o próprio aluno a
// tivesse criado no primeiro acesso.
const SENHA_DAS_CONTAS = 'senha123';
const SENHA_DOS_ALUNOS = 'aluno2026';

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
  await tx.alunos.deleteMany();
  await tx.exerciciosprof.deleteMany();
  await tx.classesprof.deleteMany();
  await tx.campanhassolo.deleteMany();
  await tx.exerciciossolo.deleteMany();
  await tx.users.deleteMany();
}

// ============================================================================
// 2. Contas (Users) e Solo
// ============================================================================

// As três contas do mock, com os mesmos ids, nomes e e-mails. A tabela não
// tem perfil: o que muda entre elas é o que cada uma tem.
//   u-1 leo   Solo com campanha; professor de UMA turma (turma-5)
//   u-2 prof  professor das turmas 1 a 4 e 6 a 8; Solo recém-começado
//   u-3 ana   nada: sem campanha e sem turma (os estados vazios)
async function inserirContas(tx: Transacao, senhaHash: string): Promise<void> {
  await tx.users.createMany({
    data: [
      { ID: 'u-1', Nome: 'Leonardo', Email: 'leo@teclar.dev', SenhaHash: senhaHash },
      { ID: 'u-2', Nome: 'Henrique Lima', Email: 'prof@teclar.dev', SenhaHash: senhaHash },
      { ID: 'u-3', Nome: 'Ana Pires', Email: 'ana@teclar.dev', SenhaHash: senhaHash },
    ],
  });
}

// As duas campanhas nascem no nível 1 com 0 XP, como a do botão "Começar"
// do lobby. O mock dá à camp-1 nível 4 e 669 XP, mas esse XP é a soma de
// dez sessões Solo que o seed não cria; gravar 669 sem elas faria a
// campanha e o histórico contarem histórias diferentes.
async function inserirSolo(tx: Transacao): Promise<void> {
  await tx.campanhassolo.createMany({
    data: [
      { CampanhaID: 'camp-1', JogadorID: 'u-1', NivelAtual: 1, XPTotal: 0 },
      { CampanhaID: 'camp-2', JogadorID: 'u-2', NivelAtual: 1, XPTotal: 0 },
    ],
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
// 3. Escola: exercícios, turmas, alunos e sessões
// ============================================================================

// Os exercícios do mock, com os mesmos ids e textos. Todos de u-2, menos o
// ex-prof-6, que é o único de leo (u-1) e só vai para a turma-5 dele.
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
  {
    id: 'ex-prof-6',
    professor: 'u-1',
    titulo: 'Aquecimento',
    dificuldade: 'facil',
    tempo: 0,
    texto: 'O rato roeu a rolha do garrafão do rei da Rússia enquanto o gato observava da janela.',
  },
] as const;

async function inserirExercicios(tx: Transacao): Promise<void> {
  await tx.exerciciosprof.createMany({
    data: EXERCICIOS_DO_PROFESSOR.map((ex) => ({
      ExerciseID: ex.id,
      // Sem `professor` na lista acima é de u-2, o dono de quase todos.
      ProfessorID: 'professor' in ex ? ex.professor : 'u-2',
      Titulo: ex.titulo,
      Texto: ex.texto,
      Dificuldade: ex.dificuldade,
      Tempo_Limite_Segundos: ex.tempo,
    })),
  });
}

// As oito turmas do mock, com os mesmos ids, nomes e códigos.
//
// O CÓDIGO é o que o professor escreve na lousa e o aluno digita no login:
// 6 caracteres de A-Z e 2-9, sem os que se confundem (I e 1, O e 0). Os
// daqui são fixos, iguais aos do mock; os de turma nova o back gera.
//
// Ano e Semestre preenchidos (nenhuma rota grava, mas o seed pode) para o
// "2026 · 1º semestre" ter de onde vir. A turma-7 fica sem os dois, como
// no mock: é o cartão sem período.
const TURMAS = [
  { id: 'turma-1', codigo: 'K7M2QX', professor: 'u-2', nome: '9º Ano A — Manhã', ano: 2026, semestre: 1, capa: 7001, criada: '2026-02-01', ativa: true },
  { id: 'turma-2', codigo: 'R8VD3K', professor: 'u-2', nome: 'Reforço de digitação', ano: 2026, semestre: 1, capa: 7138, criada: '2026-02-10', ativa: true },
  { id: 'turma-3', codigo: 'B5TJ9W', professor: 'u-2', nome: 'Projeto de Extensão 2025', ano: 2025, semestre: 2, capa: 7275, criada: '2025-08-15', ativa: true },
  { id: 'turma-4', codigo: 'H3ZT6B', professor: 'u-2', nome: '7º Ano C — Tarde', ano: 2026, semestre: 1, capa: 7412, criada: '2026-03-02', ativa: true },
  { id: 'turma-5', codigo: 'D6YG2S', professor: 'u-1', nome: 'Oficina de digitação', ano: 2026, semestre: 1, capa: 7549, criada: '2026-03-10', ativa: true },
  { id: 'turma-6', codigo: 'M9QE4L', professor: 'u-2', nome: 'Oficina de férias', ano: 2026, semestre: 2, capa: 7686, criada: '2026-07-01', ativa: true },
  { id: 'turma-7', codigo: 'X2CF7N', professor: 'u-2', nome: '1º Médio — Informática', ano: null, semestre: null, capa: null, criada: '2026-07-15', ativa: true },
  // A arquivada: é ela que faz o "Mostrar arquivadas" aparecer.
  { id: 'turma-8', codigo: 'P4WN8R', professor: 'u-2', nome: '8º Ano B — 2025', ano: 2025, semestre: 2, capa: 7823, criada: '2025-08-04', ativa: false },
];

async function inserirTurmas(tx: Transacao): Promise<void> {
  await tx.classesprof.createMany({
    data: TURMAS.map((turma) => ({
      ClassID: turma.id,
      Codigo: turma.codigo,
      ProfessorID: turma.professor,
      NomeTurma: turma.nome,
      Ano: turma.ano,
      Semestre: turma.semestre,
      CapaSemente: turma.capa,
      Ativa: turma.ativa,
      Data_Criacao: new Date(turma.criada),
    })),
  });

  // As atribuições do mock. A turma-1 tem 8 (a trilha longa, que
  // serpenteia); a turma-4 nenhuma (o estado vazio da aba Exercícios).
  // Prazo fica NULL: nenhuma rota grava prazo ainda.
  await tx.atribuicoesprof.createMany({
    data: [
      atribuicao('turma-1', 'ex-prof-1', '2026-02-03'),
      atribuicao('turma-1', 'ex-prof-2', '2026-02-17'),
      atribuicao('turma-1', 'ex-prof-7', '2026-03-20'),
      atribuicao('turma-1', 'ex-prof-8', '2026-03-24'),
      atribuicao('turma-1', 'ex-prof-9', '2026-03-27'),
      atribuicao('turma-1', 'ex-prof-10', '2026-03-31'),
      atribuicao('turma-1', 'ex-prof-11', '2026-04-03'),
      atribuicao('turma-1', 'ex-prof-12', '2026-04-07'),
      atribuicao('turma-2', 'ex-prof-3', '2026-02-11'),
      atribuicao('turma-2', 'ex-prof-5', '2026-03-04'),
      atribuicao('turma-3', 'ex-prof-1', '2025-08-20'),
      atribuicao('turma-3', 'ex-prof-2', '2025-08-20'),
      atribuicao('turma-3', 'ex-prof-3', '2025-09-01'),
      atribuicao('turma-5', 'ex-prof-6', '2026-03-10'),
    ],
  });
}

function atribuicao(turmaId: string, exercicioId: string, data: string) {
  return { ClassID: turmaId, ExerciseID: exercicioId, Data_Atribuicao: new Date(data) };
}

// Os alunos do mock, turma por turma (banco v8: o aluno nasce dentro da
// turma). O `senha` diz se ele já fez o primeiro acesso:
//   true   SenhaHash = hash de SENHA_DOS_ALUNOS (já entrou)
//   false  SenhaHash NULL (nunca entrou: o próximo login grava a senha)
//
// Ana Pires está em TRÊS turmas, e são três linhas independentes —
// al-43-t1, al-43 e al-43-t5 —, cada uma com a sua senha e o seu
// histórico. O código da turma é o que diz qual delas entra.
const ALUNOS = [
  // turma-1 (K7M2QX): a dos relatórios. Davi nunca entrou.
  { id: 'al-43-t1', turma: 'turma-1', nome: 'Ana Pires', entrou: '2026-02-01', senha: true },
  { id: 'al-44', turma: 'turma-1', nome: 'Caio Ferreira', entrou: '2026-02-01', senha: true },
  { id: 'al-45', turma: 'turma-1', nome: 'Davi Moreira', entrou: '2026-02-24', senha: false },
  { id: 'al-49', turma: 'turma-1', nome: 'Marina Duarte Alves', entrou: '2026-02-05', senha: true },
  // turma-2 (R8VD3K): a do aluno de teste (al-43) e dos colegas do ranking.
  { id: 'al-46', turma: 'turma-2', nome: 'Helena Rocha', entrou: '2026-02-10', senha: true },
  { id: 'al-43', turma: 'turma-2', nome: 'Ana Pires', entrou: '2026-02-12', senha: true },
  { id: 'al-50', turma: 'turma-2', nome: 'Bruno Sato', entrou: '2026-02-10', senha: true },
  { id: 'al-51', turma: 'turma-2', nome: 'Carla Nunes', entrou: '2026-02-10', senha: true },
  { id: 'al-52', turma: 'turma-2', nome: 'Diego Ramos', entrou: '2026-02-10', senha: true },
  { id: 'al-53', turma: 'turma-2', nome: 'Elisa Prado', entrou: '2026-02-10', senha: true },
  { id: 'al-54', turma: 'turma-2', nome: 'Fábio Mendes', entrou: '2026-02-10', senha: true },
  { id: 'al-55', turma: 'turma-2', nome: 'Gabriela Luz', entrou: '2026-02-10', senha: true },
  // turma-4 (H3ZT6B): Júlia nunca entrou.
  { id: 'al-47', turma: 'turma-4', nome: 'Igor Batista', entrou: '2026-03-02', senha: true },
  { id: 'al-48', turma: 'turma-4', nome: 'Júlia Campos', entrou: '2026-03-02', senha: false },
  // turma-5 (D6YG2S), de leo: a terceira Ana.
  { id: 'al-43-t5', turma: 'turma-5', nome: 'Ana Pires', entrou: '2026-03-12', senha: true },
];

async function inserirAlunos(tx: Transacao, senhaHash: string): Promise<void> {
  await tx.alunos.createMany({
    data: ALUNOS.map((aluno) => ({
      ID: aluno.id,
      ClassID: aluno.turma,
      Nome: aluno.nome,
      SenhaHash: aluno.senha ? senhaHash : null,
      Data_Cadastro: new Date(aluno.entrou),
    })),
  });
}

// Sessões tiradas do mock (mesmos ids e números). Cobrem o que os
// relatórios precisam mostrar: concluídas, uma que estourou o tempo em cada
// turma (Concluida = false) e precisão baixa (al-49).
//
// As da turma-1 são da Ana DA TURMA-1 (al-43-t1) e as da turma-2, da Ana
// da turma-2 (al-43): cada uma tem o próprio histórico. O ClassID da sessão
// é sempre a turma do aluno, como o POST /sessoes vai gravar.
async function inserirSessoes(tx: Transacao): Promise<void> {
  await tx.sessionsprof.createMany({
    data: [
      // turma-1
      sessao('ses-1', 'al-43-t1', 'ex-prof-1', 'turma-1', 40, 95, 76, 4, 58, true, new Date('2026-02-18T14:10:00Z')),
      sessao('ses-2', 'al-43-t1', 'ex-prof-2', 'turma-1', 36, 92, 80, 7, 61, true, new Date('2026-02-19T09:30:00Z')),
      sessao('ses-4', 'al-44', 'ex-prof-2', 'turma-1', 29, 88, 81, 11, 96, true, diasAtras(6)),
      sessao('ses-5', 'al-44', 'ex-prof-1', 'turma-1', 24, 81, 77, 18, 120, false, diasAtras(3)),
      sessao('ses-6', 'al-49', 'ex-prof-1', 'turma-1', 33, 79, 79, 21, 104, true, diasAtras(2)),
      sessao('ses-7', 'al-49', 'ex-prof-2', 'turma-1', 30, 76, 86, 27, 131, true, diasAtras(9)),
      // turma-2
      sessao('ses-8', 'al-43', 'ex-prof-3', 'turma-2', 28, 84, 126, 24, 178, true, diasAtras(26)),
      sessao('ses-9', 'al-43', 'ex-prof-3', 'turma-2', 31, 86, 129, 21, 165, true, diasAtras(22)),
      sessao('ses-10', 'al-43', 'ex-prof-5', 'turma-2', 30, 82, 41, 9, 45, false, diasAtras(18)),
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
