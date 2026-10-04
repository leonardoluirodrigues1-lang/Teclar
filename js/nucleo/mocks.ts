// mocks.ts
// Respostas FALSAS com EXATAMENTE o mesmo formato que a API real vai usar.
// Se o mock mentir sobre o formato (nome de campo, tipo, forma do objeto),
// a tela é construída em cima da mentira e quebra no dia da integração com
// o back. Ao mexer em qualquer resposta daqui, alinhe com o contrato do back.
//
// Consumido só pelo api.js, e só enquanto CONFIG.MOCK for true.
//
// Convenções deste mock:
//  - listagem paginável devolve o envelope { total, pagina, itens };
//    listagem naturalmente curta (categorias, turmas, alunos da turma,
//    exercícios da turma, campanhas, missões) devolve array puro;
//  - detalhe (por id) devolve um objeto único e é o ÚNICO lugar que inclui
//    o texto completo do exercício — com uma exceção de contrato: a
//    biblioteca do professor (GET /exercicios) traz o texto em cada item,
//    porque é ele que a tela edita e conta;
//  - o "banco" (objeto `dados`) vive em memória e reinicia a cada F5. Isso é
//    proposital: todo teste parte do mesmo estado.
//
// ============================================================================
// CONTAS DE TESTE — para entrar sem o back de pé
// ============================================================================
//
// Uma conta é uma conta: a tabela Users NÃO tem coluna de perfil. Toda
// conta abre o Solo E o Professor; o que muda entre eles é o modo escolhido
// depois do login (ver sessao.modo), não a conta.
//
//   Conta   prof@teclar.dev   senha123   Professor: dona das turmas 1–4 e
//                                        dos exercícios ex-prof-1..5 (tudo
//                                        que já existia). Solo: camp-2
//                                        (recém-começada, nível 1, 0 XP)
//   Conta   leo@teclar.dev    senha123   Professor: UMA turma (turma-5) e
//                                        UM exercício (ex-prof-6). Solo:
//                                        camp-1 (nível 4, 669 XP)
//   Conta   ana@teclar.dev    senha123   Professor: NENHUMA turma, NENHUM
//                                        exercício (estado vazio). Solo:
//                                        SEM campanha
//
// ENTRADAS DE ALUNO — "Sou aluno" no login, com RP e senha de aluno. Toda
// conta tem uma; a senha de aluno de todas as de teste é a mesma:
//
//   RP2025043   Aluno#2025   de ana. O ALUNO DE TESTE: está em TRÊS
//                            salas — turma-1 (falta 1 exercício, e só 2
//                            sessões concluídas: o relatório mostra quanto
//                            falta), turma-2 (tudo feito: estrela no
//                            cartão; e SEXTO lugar no ranking de 8) e
//                            turma-5 (nenhum feito) —, tem histórico e UM
//                            convite pendente (turma-4).
//   RP2025001   Aluno#2025   de leo. Em sala nenhuma e sem convite
//                            nenhum (os dois estados vazios).
//   RP2025002   Aluno#2025   de prof. Em sala nenhuma.
//
// Pode digitar com espaço ("RP 2025043") ou minúsculo: a tela normaliza.
// Os outros alunos das turmas (RP2025044 a RP2025049) também são contas de
// alguém no banco de verdade, mas não têm login semeado aqui: nenhuma tela
// precisa entrar como eles.
//
// ============================================================================
// MUDANÇAS DE BANCO QUE ESTE MOCK JÁ SUPÕE (ainda sendo combinadas)
// ============================================================================
//
//   Alunos        ganha UserID -> Users.ID. Toda conta tem exatamente uma
//                 linha em Alunos, criada no cadastro, com o RP no ID e o
//                 hash da senha de aluno. O professor não cria mais aluno.
//   ClassMembers  ganha Status ('convidado' | 'ativo' | 'recusado') e
//                 Data_Convite. O professor convida pelo RP; só depois de o
//                 aluno aceitar ele está na sala.
//                 Data_Matricula JÁ EXISTE e muda de significado: passa a
//                 ser a data do ACEITE (NULL enquanto convidado), e não mais
//                 a data em que o professor matriculou.
//
// O front e este mock já se comportam como se as duas existissem. Quem gera
// o RP e a senha de aluno é o BACK, no POST /auth/cadastro (e a senha nova,
// no POST /conta/rp/nova-senha); o gerarRp() e o gerarSenhaAluno() daqui
// são só um jeito simples de imitar isso.
//
// NOME DO ALUNO. Como Alunos aponta para Users, o aluno e a conta são a
// mesma pessoa: o nome do aluno é o Nome da conta dona. A coluna Nome de
// Alunos continua, só para aluno antigo sem conta ligada. O back devolve o
// primeiro que existir (Users.Nome, depois Alunos.Nome); sem nenhum, vem
// null e a tela mostra o RP. Aqui no mock o nome já vem escrito nas linhas.
//
// DONO. ClassesProf e ExerciciosProf têm ProfessorID, e com conta única é
// isso — e só isso — que faz uma conta ser professora. Toda turma e todo
// exercício aqui tem `professorId`, e TODA rota do mundo Professor filtra
// pelo id da conta do token: listar, detalhar, criar, renomear, atribuir,
// remover, relatórios, biblioteca. Turma ou exercício de outra conta é 404,
// não 403 — não se confirma que o recurso existe. Criar turma ou exercício
// grava o professorId da conta do token. Ver turmaDaConta / exercicioDaConta.
//
// Para testar UMA conta nos dois mundos sem editar código: entre com leo ou
// prof, escolha Solo, e depois "Ir para Professor" no cabeçalho (ou o
// contrário pelo menu do avatar).
//
// leo e ana existem por causa do lobby do Solo (pages/solo/dashboard.html),
// que tem dois estados e mostra um só:
//   leo@teclar.dev  -> entra com camp-1: o painel de "Continuar", com
//                      nível e barra de XP.
//   ana@teclar.dev  -> entra sem campanha: o convite "Começar campanha".
// Quem se cadastra pela tela de cadastro também nasce sem campanha.
//
// Qualquer outra credencial responde 401. No cadastro, leo@teclar.dev
// responde 409 ("e-mail já tem conta") — é o caminho para testar o erro no
// campo de e-mail. Para testar o 403 ("conta desativada"), mude `ativo`
// para false na conta desejada, em CONTAS (seção 5 deste arquivo).

import { CONFIG } from '../config.js';
import { sequenciaDeDias } from '../utils/desempenho.js';
import type {
  Aluno,
  Atribuicao,
  Campanha,
  Categoria,
  DesempenhoLicaoSolo,
  Dificuldade,
  ErroDaApi,
  EstatisticasSolo,
  Exercicio,
  MissaoDetalhe,
  Paginado,
  Parametros,
  RelatorioAluno,
  RelatorioExercicio,
  RelatorioTurma,
  RespostaCadastro,
  ConviteDoAluno,
  ConvidadoDaTurma,
  DesempenhoNaTurma,
  LinhaDoRanking,
  EstadoNaTurma,
  LinhaDaTurma,
  ResultadoConvites,
  SalaDetalhe,
  SalaDoAluno,
  ExercicioDaSala,
  EstadoExercicioDaSala,
  RespostaLogin,
  ResumoDoAluno,
  Sessao,
  SessaoDoAluno,
  SessaoDoHistorico,
  SessaoSolo,
  Turma,
  Usuario,
} from './tipos.js';

// ============================================================================
// 1. TEXTOS de treino (português real, sem lorem ipsum)
// ============================================================================

const TEXTOS = {
  // Curto: uma frase.
  curto:
    'O rato roeu a rolha do garrafão do rei da Rússia enquanto o gato observava da janela.',

  // Médio: um parágrafo.
  paragrafo:
    'A prática constante transforma o movimento pensado em gesto automático. ' +
    'No começo, cada tecla exige atenção e o olhar corre para as mãos a toda hora. ' +
    'Com o tempo, os dedos aprendem o caminho sozinhos e a mente fica livre para ' +
    'acompanhar o sentido do texto, não a posição das letras. Digitar bem é, no fim, ' +
    'parar de pensar em digitar.',

  // Código JavaScript (com quebras de linha e indentação reais).
  codigo:
    'function calcularMedia(valores) {\n' +
    '  if (valores.length === 0) return 0;\n' +
    '  const soma = valores.reduce((total, n) => total + n, 0);\n' +
    '  return soma / valores.length;\n' +
    '}',

  // Números e símbolos.
  numeros:
    'O pedido #4837 saiu por R$ 1.299,90 com 15% de desconto no dia 07/02/2026 às 14:35. ' +
    'Confirme em suporte@teclar.dev ou pelo ramal 210 (opção 3). Itens: 12 + 4 brindes.',

  // Muita acentuação.
  acentuacao:
    'À noite, o céu límpido de setembro revelava constelações que só a avó reconhecia. ' +
    '"É a estação das águas", dizia ela, com convicção serena, enquanto o café esfriava ' +
    'sobre a mesa. Ninguém ousava contestá-la: três gerações já decoraram aquela lição.',
};

// Não há mais tabela de "texto por exercício do Solo": as lições reais
// carregam o próprio texto (ver LICOES, seção 1b), como o exercício do
// professor sempre carregou o dele (ver dados.exercicios). Os TEXTOS acima
// servem agora só à biblioteca do professor.

// ============================================================================
// 4. USUARIOS de teste
// ============================================================================

// O `usuario` devolvido no login e no cadastro. Espelha a tabela Users:
// ID, Nome, Email. Não tem senha, não tem hash, não tem GoogleID — nada
// disso serve para a tela e nada disso deve trafegar. E não tem perfil,
// porque a tabela não tem: `tipo` diz só de qual tabela o login veio.
export const USUARIOS: {
  leo: Usuario;
  ana: Usuario;
  prof: Usuario;
  aluno: Usuario;
} = {
  leo: {
    id: 'u-1',
    nome: 'Leonardo',
    email: 'leo@teclar.dev',
    tipo: 'conta',
    // Conveniência que o back manda junto para a tela não ter de pedir de
    // novo logo depois do login. Não é da tabela Users: é o id da campanha
    // deste jogador (camp-1), o mesmo que GET /solo/campanha devolve.
    campanhaAtiva: 'camp-1',
  },
  // A segunda conta: nunca entrou no Solo. SEM campanhaAtiva de propósito
  // — é ela que mostra o estado 1 do lobby (o convite). Não invente
  // campanha para ela aqui; quem cria é o botão da tela.
  ana: {
    id: 'u-3',
    nome: 'Ana Pires',
    email: 'ana@teclar.dev',
    tipo: 'conta',
  },
  // Também tem campanha (camp-2, recém-começada): é a conta para ver o
  // mesmo login nos dois mundos, Solo e Professor.
  prof: {
    id: 'u-2',
    nome: 'Henrique Lima',
    email: 'prof@teclar.dev',
    tipo: 'conta',
    campanhaAtiva: 'camp-2',
  },
  // Aluno vem da tabela Alunos: ID (o RP), SenhaHash e UserID (a conta
  // dona, aqui ana — ver CONTAS). SEM e-mail, porque a coluna não existe.
  // O nome é o da conta dona (ver NOME DO ALUNO no cabeçalho).
  aluno: {
    id: 'RP2025043',
    nome: 'Ana Pires',
    tipo: 'aluno',
    // Conveniência, como acima: um aluno pode estar em várias turmas.
    turmas: [
      { id: 'turma-1', nome: '9º Ano A — Manhã' },
      { id: 'turma-2', nome: 'Reforço de digitação' },
      { id: 'turma-5', nome: 'Oficina de digitação' },
    ],
  },
};

// ============================================================================
// 1b. LICOES — as 76 lições do Solo
// ============================================================================
// O conteúdo inicial do mundo Solo: as lições que o professor escreveu e
// que já foram semeadas na tabela ExerciciosSolo. Não são exemplo nem
// enfeite de mock — são o percurso de verdade, e a tela de campanhas
// mostra exatamente estas 76, na ordem em que estão aqui.
//
// Vieram de um CSV (id, nivel, texto, repeticoes, tempo_maximo_segundos) e
// foram convertidas para literal UMA VEZ, na conversão que gerou este
// bloco. O front NÃO lê CSV em tempo de execução: isso é conteúdo semeado,
// não importação de arquivo, e um parser no navegador só criaria uma
// segunda chance de corromper o texto do professor.
//
// O texto é do professor e está como ele escreveu — acento, símbolo de
// teclado ABNT2, aspas, apóstrofo, barra invertida e tudo mais. Nada foi
// "corrigido" aqui. As lições 35 e 36 são as que mais sofrem com leitor de
// CSV distraído (o arquivo escapava aspa e barra com barra invertida); se
// alguma delas aparecer com barra sobrando na tela, o erro está na
// conversão, não no professor.
//
// Tupla, e não objeto: são as cinco colunas que o professor preencheu, e
// só elas. Título, dificuldade e tamanho são DERIVADOS logo abaixo, pela
// mesma regra usada na carga do banco — escrever os 76 títulos à mão aqui
// seria 76 oportunidades de divergir do que está gravado lá.
type LinhaLicao = [
  ordem: number,
  nivel: number,
  repeticoes: number,
  tempoLimiteSegundos: number,
  texto: string,
];

// Os dez nomes de nível, exatamente como o professor os batizou. Entram no
// título de cada lição e no cabeçalho de cada grupo na tela de campanhas.
const NOMES_DE_NIVEL: Record<number, string> = {
  1: 'Linha-guia',
  2: 'Fileiras e pontuação',
  3: 'Vocabulário real',
  4: 'Maiúsculas e frases',
  5: 'Números e valores',
  6: 'Símbolos e código',
  7: 'Texto profissional',
  8: 'Pangramas e acentuação',
  9: 'Parágrafos corporativos',
  10: 'Textos longos',
};

// Níveis 1 a 3 fáceis, 4 a 7 médios, 8 a 10 difíceis. A mesma regra da
// carga do banco: a dificuldade não é coluna que o professor preencheu,
// é consequência do nível.
function dificuldadeDoNivel(nivel: number): Dificuldade {
  if (nivel <= 3) return 'facil';
  if (nivel <= 7) return 'medio';
  return 'dificil';
}

// Uma linha do CSV vira a lição completa que a API devolve.
//   ExerciseID  'solo-001' … 'solo-076', três dígitos, na ordem do percurso
//   título      'Lição NN — <nome do nível>', NN com dois dígitos
//   tamanho     o comprimento do texto, contado aqui e não digitado à mão
function montarLicao([ordem, nivel, repeticoes, tempoLimiteSegundos, texto]: LinhaLicao): MissaoDetalhe {
  return {
    exerciseId: `solo-${String(ordem).padStart(3, '0')}`,
    ordem,
    nivel,
    titulo: `Lição ${String(ordem).padStart(2, '0')} — ${NOMES_DE_NIVEL[nivel]}`,
    dificuldade: dificuldadeDoNivel(nivel),
    repeticoes,
    tempoLimiteSegundos,
    tamanhoCaracteres: texto.length,
    texto,
  };
}

// [ordem, nivel, repeticoes, tempoLimiteSegundos, texto]
const LICOES: LinhaLicao[] = [
  [1, 1, 10, 472, 'asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg'],
  [2, 1, 10, 472, 'asdf jklç asdf jklç asdf jklç asdf jklç asdf jklç asdf jklç'],
  [3, 1, 10, 472, 'hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç'],
  [4, 1, 10, 472, 'asdfg hjklç asdfg hjklç asdfg hjklç asdfg hjklç asdfg hjklç'],
  [5, 1, 10, 472, 'ffff jjjj dddd kkkk ssss llll aaaa çççç ffff jjjj dddd kkkk'],
  [6, 1, 10, 464, 'fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjds'],
  [7, 1, 10, 472, 'dad fad jak lad sad gal sag dal gas jab lab lad sal fad bad'],
  [8, 1, 10, 496, 'ala ala lala dada saga gaga jaca jala fala sala gala bala mala'],
  [9, 2, 10, 354, 'asdf ,;;, jklç asdf ,;;, jklç asdf ,;;, jklç asdf ,;;, jklç'],
  [10, 2, 10, 354, 'zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm,'],
  [11, 2, 10, 354, 'qwer tyui qwer tyui qwer tyui poiu trew qwer tyui qwer tyui'],
  [12, 2, 10, 354, 'qaz wsx edc rfv tgb yhn ujm ik, ol. pç/ qaz wsx edc rfv tgb'],
  [13, 2, 10, 354, 'qwe rty uio pas dfg hjkl zxc vbn m,./ qwe rty uio pas dfg hjk'],
  [14, 2, 10, 354, 'zaq xsw cde vfr bgt nhy mju k,i l.o ç/p zaq xsw cde vfr bgt'],
  [15, 3, 10, 281, 'aq sw de fr gt hy ju ki lo pç aq sw de fr gt hy ju ki lo pç'],
  [16, 3, 10, 281, 'casa pato bola gato rato vela mala pipa saco luva mesa sofa'],
  [17, 3, 10, 281, 'fala gata saca jaca data sela mola neta cova lona sola ralo'],
  [18, 3, 10, 281, 'pino fino sino lino tino dino mina rina tina bina luto boto'],
  [19, 3, 10, 281, 'foco loco poco roco toco boco soco noco mudo tudo judo rudo'],
  [20, 4, 10, 244, 'AsDf GtHy JuKi LoPç QwEr TyUi ZxCv BnM, AsDf GhJk LçQw ErTy'],
  [21, 4, 10, 244, 'A Casa Branca tem Janela Azul e Porta Verde no Segundo Andar'],
  [22, 4, 10, 240, 'a veloz raposa marrom pula sobre o cao preguicoso da granja.'],
  [23, 4, 10, 228, 'O Rapido Cão de Caça Salta Acima da Velha Raposa Cansada.'],
  [24, 4, 10, 240, 'Maria foi ao mercado comprar Pão, Leite, Café e Frutas Frescas.'],
  [25, 4, 10, 232, 'Quem Venceu a Corrida de Ontem? O Atleta da Equipe Vermelha!'],
  [26, 5, 10, 202, '1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234 5678'],
  [27, 5, 10, 202, '1a2s 3d4f 5g6h 7j8k 9l0ç 1a2s 3d4f 5g6h 7j8k 9l0ç 1a2s 3d4f'],
  [28, 5, 10, 202, '!@#$ %¨&* ()_+ !@#$ %¨&* ()_+ !@#$ %¨&* ()_+ !@#$ %¨&* ()_+'],
  [29, 5, 10, 195, 'Preco: R$ 150,00 (desconto de 10% para pagamento a vista).'],
  [30, 5, 10, 192, 'A aquisicao de velocidade depende da constancia absoluta.'],
  [31, 5, 10, 229, 'qazwsxedcrfvtgbyhnujmikolpç asdfjklç qazwsxedcrfvtgbyhnujmikolpç'],
  [32, 5, 10, 209, 'Produto SKU-9841: Estoque de 500 unidades, valor unit. $45.50.'],
  [33, 6, 10, 186, '13579 24680 13579 24680 13579 24680 13579 24680 13579 24680 13579'],
  [34, 6, 10, 186, 'a1b2 c3d4 e5f6 g7h8 i9j0 k1l2 m3n4 o5p6 q7r8 s9t0 u1v2 w3x4 y5z6'],
  [35, 6, 10, 186, '"\'~^ ´`çÇ ªº §¢£³²¹ ?/°ºª "\'~^ ´`çÇ ªº §¢£³²¹ ?/°ºª "\'~^ ´`çÇ'],
  [36, 6, 10, 186, '[{} ]+* -_=/ ?><:; "\'~^ |\\ ~]}[ {=+* -_=/ ?><:; "\'~^ |\\ ~]}['],
  [37, 6, 10, 186, '24680 97531 86420 75319 48260 15937 36925 80417 24680 97531'],
  [38, 6, 10, 189, '{[a+b] = c*d / (e-f)}; [x_1 + x_2] >= 100 && y <= 50 || z == 0;'],
  [39, 7, 10, 172, 'A prática constante e diária leva à perfeição na digitação por toque.'],
  [40, 7, 10, 198, 'O desenvolvimento de software exige precisão ao digitar códigos e variáveis.'],
  [41, 7, 10, 214, 'Exemplo de e-mail: usuario_teste.2026@empresa-br.com.br (código #4092).'],
  [42, 7, 10, 115, 'Acesse https://sistema-exemplo.gov.br'],
  [43, 7, 10, 256, 'Relatório Financeiro Q3: Lucro líquido de R$ 1.240.500,75 (crescimento de 14.2%).'],
  [44, 8, 10, 165, 'The quick brown fox jumps over the lazy dog. 0123456789 !@#$%^&*()_+'],
  [45, 8, 10, 158, 'Investimento total: R$ 8.450,90 com taxa de juros de 2,5% ao mês.'],
  [46, 8, 10, 208, 'Paralelepípedo, constituição, beneficência, idiosyncratic, anticonstitucionalissimamente.'],
  [47, 8, 10, 172, 'Zé Ramalho jogou xadrez com blitz de 5 minutos sob forte chuva no gramado.'],
  [48, 8, 10, 177, 'Gazeta publica hoje que quinze bruxas trouxeram dezquilos de feijão quebrado.'],
  [49, 1, 10, 472, 'ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl'],
  [50, 1, 10, 432, 'asdf fds a s d f jkl lkj j k l ç a s d f j k l ç'],
  [51, 2, 10, 297, 'poiuytrewq poiuytrewq poiuytrewq poiuytrewq poiuytrewq'],
  [52, 2, 10, 336, 'mnbvcxz lkjhgfdsap mnbvcxz lkjhgfdsap mnbvcxz lkjhgfdsap'],
  [53, 3, 10, 268, 'livro papel caneta lapis borracha pasta bloco pasta regua'],
  [54, 3, 10, 273, 'chuva vento terra pedra folha galho grama flor fruta verde'],
  [55, 4, 10, 256, 'O Rato Roeu a Roupa do Rei de Roma em uma Noite Fria de Inverno.'],
  [56, 4, 10, 244, 'Por favor, envie o documento assinado ate as dezesseis horas.'],
  [57, 5, 10, 202, '9876 5432 1098 7654 3210 9876 5432 1098 7654 3210 9876 5432'],
  [58, 5, 10, 209, 'Conta #4829-1: Saldo atual de R$ 4.250,00 (Extrato Bancario).'],
  [59, 6, 10, 174, 'const express = require(\'express\'); const app = express();'],
  [60, 6, 10, 192, '<div class="container"><p id="text-main">Carregando...</p></div>'],
  [61, 7, 10, 221, 'Notificacao de sistema: Conexao segura estabelecida em wss://api.servidor.net:8443.'],
  [62, 7, 10, 176, 'Favor confirmar o agendamento da reuniao via protocolo ID#99382-X.'],
  [63, 8, 10, 199, 'Todo mundo deseja aprender novas habilidades para prosperar na era digital moderna.'],
  [64, 8, 10, 206, 'Linux, Python, JavaScript, TypeScript, PostgreSQL e Docker sao ferramentas essenciais.'],
  [65, 9, 5, 123, 'A digitação rápida é útil, mas a precisão é o que realmente importa no dia a dia profissional. Quem digita sem olhar para o teclado ganha tempo precioso.'],
  [66, 9, 5, 138, 'Ao estruturar um e-mail corporativo, lembre-se de usar cumprimentos formais adequados. A clareza na comunicação escrita evita mal-entendidos e retrabalho em equipe.'],
  [67, 9, 5, 142, 'Os atalhos de teclado e a memorização das teclas de símbolos aceleram tarefas cotidianas. Praticar alguns minutos todos os dias gera resultados surpreendentes a médio prazo.'],
  [68, 9, 5, 134, 'A tecnologia avança rápido e exige constante adaptação dos profissionais. Estar preparado significa dominar ferramentas digitais básicas com total naturalidade e fluidez.'],
  [69, 9, 5, 147, 'O sucesso de um projeto depende do alinhamento entre planejamento estratégico e execução técnica. Documentar cada etapa garante transparência e rastreabilidade para os gestores.'],
  [70, 9, 5, 140, 'Manter a postura correta e os pulsos elevados previne lesões por esforço repetitivo. A ergonomia é tão importante quanto a velocidade durante longas jornadas de trabalho.'],
  [71, 10, 2, 94, 'A prática da digitação por toque é uma habilidade transformadora na era digital. Quando os dedos encontram as teclas de forma automática e inconsciente, a mente humana se liberta por completo para focar inteiramente na criatividade, na lógica e na profundidade do conteúdo que está sendo produzido, eliminando de vez qualquer barreira física entre o pensamento veloz e a tela do computador.'],
  [72, 10, 2, 106, 'No ecossistema de desenvolvimento de software moderno, a colaboração ágil entre equipes multidisciplinares é o motor da inovação. Desenvolvedores, designers e analistas de produto compartilham repositórios de código, revisam pull requests e automatizam rotinas de entrega contínua, garantindo que novas funcionalidades cheguem aos usuários com estabilidade, segurança e alta performance operacional em servidores de nuvem.'],
  [73, 10, 2, 102, 'O planejamento financeiro pessoal requer disciplina rigorosa, acompanhamento constante de despesas e visão de longo prazo. Investir uma porcentagem fixa da renda mensal em ativos diversificados protege o patrimônio contra a inflação e abre caminhos sólidos para a independência financeira, permitindo escolhas de vida mais livres, conscientes e alinhadas aos seus verdadeiros propósitos individuais.'],
  [74, 10, 2, 101, 'A leitura atenta de livros clássicos e artigos científicos expande o vocabulário ativo e estimula o pensamento crítico. Transportar essa riqueza de termos, pontuações complexas, travessões, aspas e conjunções para os seus treinos diários de digitação prepara suas mãos para redigir teses acadêmicas, contratos jurídicos complexos ou relatórios executivos de alto impacto sem hesitação.'],
  [75, 10, 2, 105, 'A inteligência artificial generativa e os modelos de linguagem avançados estão redefinindo a maneira como interagimos com as máquinas e processamos grandes volumes de dados textuais. Embora a automação ganhe espaço, a capacidade humana de redigir com clareza, empatia, precisão gramatical e intenção estratégica permanece como um diferencial competitivo insubstituível no mercado de trabalho globalizado contemporâneo.'],
  [76, 10, 2, 103, 'Em uma manhã fria de outono, o velho relojoeiro ajustava as engrenagens minúsculas de um cronômetro suíço com pinças de precisão cirúrgica. Cada rotação sutil exigia pulso firme e paciência infinita, virtudes que ele considerava idênticas às necessárias para dominar a arte da escrita digital por toque: um delicado equilíbrio milimétrico entre o ritmo constante, a leveza do toque e a ausência absoluta de erros.'],
];

// ============================================================================
// 2. dados — "banco" em memória, reiniciado a cada carga de página
// ============================================================================

// A forma do "banco". Os mapas por turma/campanha são indexados por id em
// tempo de execução (turmas criadas pelo mock entram aqui), por isso são
// Record e não objetos de chaves fixas.
interface BancoMock {
  categorias: Categoria[];
  parametros: Parametros;
  campanhas: Campanha[];
  // MissaoDetalhe, e não Missao: o texto mora junto com a lição, numa
  // fonte só. A listagem é que o tira antes de responder (ver a rota
  // /solo/campanhas/:id/missoes) — texto completo não trafega em lista.
  missoes: MissaoDetalhe[];
  turmas: Turma[];
  alunos: Record<string, Aluno[]>;
  convites: ConviteMock[];
  exercicios: Exercicio[];
  atribuicoes: Record<string, Atribuicao[]>;
  sessoes: Sessao[];
  historicoSolo: Record<string, SessaoSolo[]>;
}

// Um convite pendente: a linha de ClassMembers com Status = 'convidado'.
// O mock guarda os dois estados em listas separadas — `alunos` é Status =
// 'ativo', `convites` é Status = 'convidado' — porque é assim que cada
// leitor precisa deles: contador, médias e relatórios leem só `alunos`
// (o WHERE Status = 'ativo' do back), e a lista da turma do professor
// junta as duas, com o estado em cada linha (ver GET /turmas/:id/alunos).
interface ConviteMock {
  turmaId: string;
  alunoId: string;
  convidadoEm: string;
}

// ----------------------------------------------------------------------------
// Os colegas do ranking da turma-2
// ----------------------------------------------------------------------------
// Seis alunos a mais na turma-2, para o aluno de teste (RP2025043) cair em
// SEXTO lugar no ranking da sala. Os pontos são os que o back calcularia
// com a fórmula documentada em api.ts (escola.aluno.rankingDaTurma) — o
// mock não calcula, só devolve a tabela RANKING_PRONTO, mais abaixo:
//
//   1º RP2025050  2 lições, 46 PPM, 12 dias  -> 146
//   2º RP2025051  2 lições, 44 PPM, 10 dias  -> 134
//   3º RP2025052  2 lições, 47 PPM,  9 dias  -> 132
//   4º RP2025053  2 lições, 42 PPM,  8 dias  -> 122   (anônimo)
//   5º RP2025054  2 lições, 43 PPM,  7 dias  -> 118   (anônimo)
//   6º RP2025043  2 lições, 40 PPM,  3 dias  ->  95   (ELE: sempre com nome)
//   7º RP2025055  2 lições, 31 PPM,  3 dias  ->  86   (anônimo)
//   8º RP2025046  0 lições, sem ritmo, 0 dias ->  0   (anônimo)
//
// O 3º tem o MAIOR ritmo da sala e não é o primeiro: a ordem é por pontos,
// nunca por velocidade pura.
//
// Fica antes de `dados` porque `dados` usa esta lista ao ser montado.

interface ColegaDoRanking {
  id: string;
  nome: string;
  dias: number;
  wpm: number;
  precisao: number;
}

const COLEGAS_DO_RANKING: ColegaDoRanking[] = [
  { id: 'RP2025050', nome: 'Bruno Sato', dias: 12, wpm: 46, precisao: 95 },
  { id: 'RP2025051', nome: 'Carla Nunes', dias: 10, wpm: 44, precisao: 94 },
  { id: 'RP2025052', nome: 'Diego Ramos', dias: 9, wpm: 47, precisao: 93 },
  { id: 'RP2025053', nome: 'Elisa Prado', dias: 8, wpm: 42, precisao: 92 },
  { id: 'RP2025054', nome: 'Fábio Mendes', dias: 7, wpm: 43, precisao: 90 },
  { id: 'RP2025055', nome: 'Gabriela Luz', dias: 3, wpm: 31, precisao: 86 },
];

// Uma sessão concluída por dia, de (dias - 1) dias atrás até hoje,
// alternando os dois exercícios da turma-2. Assim cada colega fez os dois
// (2 lições) e tem `dias` dias seguidos.
function sessoesDoColega(colega: ColegaDoRanking): Sessao[] {
  const sessoes: Sessao[] = [];
  for (let i = 0; i < colega.dias; i++) {
    const exerciseId = i % 2 === 0 ? 'ex-prof-3' : 'ex-prof-5';
    const erros = Math.round((100 - colega.precisao) * 1.5);
    sessoes.push({
      id: `ses-${colega.id}-${i + 1}`,
      exerciseId,
      alunoId: colega.id,
      turmaId: 'turma-2',
      wpm: colega.wpm,
      precisao: colega.precisao,
      tempoSegundos: exerciseId === 'ex-prof-5' ? 40 : 140,
      // Coerentes com a precisão, como o motor calcula:
      // precisao = acertos / (acertos + erros).
      acertos: Math.round((erros * colega.precisao) / (100 - colega.precisao)),
      erros,
      concluida: true,
      data: diasAtras(colega.dias - 1 - i),
    });
  }
  return sessoes;
}

// A linha do colega na turma-2, com os agregados que as sessões geradas
// acima dão — os mesmos números que /turmas/:id/alunos mostraria.
function linhaDoColega(colega: ColegaDoRanking): Aluno {
  return {
    id: colega.id,
    nome: colega.nome,
    entrouEm: '2026-02-10',
    totalSessoes: colega.dias,
    wpmMedio: colega.wpm,
    precisaoMedia: colega.precisao,
    ultimaAtividade: diasAtras(0),
  };
}

export const dados: BancoMock = {
  // As 5 categorias do seed.
  categorias: [
    { id: 1, nome: 'Palavras comuns', ativo: true },
    { id: 2, nome: 'Parágrafos', ativo: true },
    { id: 3, nome: 'Código', ativo: true },
    { id: 4, nome: 'Números e símbolos', ativo: true },
    { id: 5, nome: 'Acentuação', ativo: true },
  ],

  // Espelha a tabela Configuracoes.
  parametros: {
    wpmMeta: 40,
    precisaoMinima: 90,
    tempoLimitePadrao: 60,
    // Mesmo motivo do bônus de precisão: um número só, morando no config.
    xpPorNivel: CONFIG.SOLO.XP_POR_NIVEL,
  },

  // camp-1 é do jogador u-1 (leo@teclar.dev); camp-2 é de u-2
  // (prof@teclar.dev), para essa conta também ter Solo. A conta u-3
  // (ana@teclar.dev) não aparece aqui: é justamente o estado "ainda não
  // começou", e é o botão do lobby que cria a campanha dela.
  //
  // Só as quatro colunas de CampanhasSolo. Um jogador tem UMA campanha:
  // duas do mesmo dono seriam indistinguíveis na tela — sem nome e sem
  // data, não há o que as diferencie.
  campanhas: [
    {
      campanhaId: 'camp-1',
      jogadorId: 'u-1',
      nivelAtual: 4,
      // 669 é a SOMA do xpGanho das dez sessões de historicoSolo['camp-1']
      // (abaixo): a campanha e o histórico contam a mesma história.
      // recalcularNivel(669) = floor(669 / 200) + 1 = 4
      // No nível 4 sobram 69 XP (669 % 200): a barra fica em 35% e faltam
      // 131 XP para o nível 5.
      xpTotal: 669,
    },
    // Como nasce uma campanha pelo botão do lobby: nível 1, 0 XP, sem
    // histórico (historicoSolo não tem 'camp-2'; as rotas caem em []).
    {
      campanhaId: 'camp-2',
      jogadorId: 'u-2',
      nivelAtual: 1,
      xpTotal: 0,
    },
  ],

  // As 76 lições do Solo, montadas a partir de LICOES (seção 1b, acima).
  // Conteúdo semeado: é o mesmo para todo jogador, ninguém cria e ninguém
  // apaga. Já saem na ordem do percurso, porque LICOES está nela.
  missoes: LICOES.map(montarLicao),

  // 6 turmas ativas de prof (u-2), mais 1 arquivada, e 1 de leo (u-1). ana (u-3) não
  // tem nenhuma: é o estado vazio da tela de turmas. Seis, e não quatro,
  // para a busca da tela de turmas (só a partir de 5) aparecer. Os convites
  // pendentes de prof estão na turma-4 (ver `convites`).
  turmas: [
    // É a primeira da lista, logo a que a tela de relatórios abre sem
    // ?turma= nenhum. Por isso é ela que carrega os três casos que o
    // relatório precisa mostrar, sem ninguém editar este arquivo: um aluno
    // que nunca treinou (RP2025045), um com precisão média abaixo de 85%
    // (RP2025049) e um que estourou o tempo num exercício (RP2025044, na
    // ses-5). Ver a lista em `alunos` e as sessões mais abaixo.
    {
      id: 'turma-1',
      professorId: 'u-2',
      nome: '9º Ano A — Manhã',
      totalAlunos: 4,
      // Oito: é a turma da trilha LONGA, que serpenteia (ver os ex-prof-8
      // a ex-prof-12 em `exercicios`). As outras salas do aluno de teste
      // ficam com a trilha curta.
      totalExercicios: 8,
      periodo: '2026 · 1º semestre',
      capaSemente: 7001,
      ativa: true,
      dataCriacao: '2026-02-01',
    },
    // Oito alunos: é a turma do ranking do aluno de teste, que fica em
    // sexto — o bastante para se ver, ao mesmo tempo, os três nomes do
    // pódio, os "Participante" anônimos e a linha dele destacada.
    {
      id: 'turma-2',
      professorId: 'u-2',
      nome: 'Reforço de digitação',
      totalAlunos: 8,
      totalExercicios: 2,
      periodo: '2026 · 1º semestre',
      capaSemente: 7138,
      ativa: true,
      dataCriacao: '2026-02-10',
    },
    // Turma sem nenhum aluno matriculado: é o cartão que mostra a contagem
    // zerada na tela de turmas, sem ninguém precisar editar este arquivo.
    // A lista em `alunos` abaixo tem de acompanhar, senão o mock diz 0 na
    // listagem e 2 no roster.
    {
      id: 'turma-3',
      professorId: 'u-2',
      nome: 'Projeto de Extensão 2025',
      totalAlunos: 0,
      totalExercicios: 3,
      periodo: '2025 · 2º semestre',
      capaSemente: 7275,
      ativa: true,
      dataCriacao: '2025-08-15',
    },
    // O caso inverso da turma-3: tem aluno e NENHUM exercício atribuído. É
    // por onde se vê o estado vazio da aba Exercícios da tela de turma sem
    // ninguém precisar desatribuir nada à mão. A lista em `atribuicoes`
    // abaixo tem de acompanhar, senão o mock diz 0 aqui e 2 lá.
    {
      id: 'turma-4',
      professorId: 'u-2',
      nome: '7º Ano C — Tarde',
      totalAlunos: 2,
      totalExercicios: 0,
      periodo: '2026 · 1º semestre',
      capaSemente: 7412,
      ativa: true,
      dataCriacao: '2026-03-02',
    },
    // Zero alunos E zero exercícios: a turma recém-criada, o cartão com as
    // duas contagens zeradas. `alunos` e `atribuicoes` não têm entrada para
    // ela; toda rota lê esses mapas com `?? []`.
    {
      id: 'turma-6',
      professorId: 'u-2',
      nome: 'Oficina de férias',
      totalAlunos: 0,
      totalExercicios: 0,
      periodo: '2026 · 2º semestre',
      capaSemente: 7686,
      ativa: true,
      dataCriacao: '2026-07-01',
    },
    // Sem período e sem capaSemente: o cartão sem a linha do período e com
    // a capa derivada do id. Vazia como a turma-6, pelo mesmo motivo.
    {
      id: 'turma-7',
      professorId: 'u-2',
      nome: '1º Médio — Informática',
      totalAlunos: 0,
      totalExercicios: 0,
      ativa: true,
      dataCriacao: '2026-07-15',
    },
    // Já arquivada: é ela que faz o "Mostrar arquivadas" da tela de turmas
    // aparecer sem ninguém precisar arquivar nada antes. Contagens zeradas
    // porque `alunos` e `atribuicoes` não têm entrada para ela (ver a
    // turma-6); desarquivada, vira mais um cartão comum.
    {
      id: 'turma-8',
      professorId: 'u-2',
      nome: '8º Ano B — 2025',
      totalAlunos: 0,
      totalExercicios: 0,
      periodo: '2025 · 2º semestre',
      capaSemente: 7823,
      ativa: false,
      dataCriacao: '2025-08-04',
    },
    // A única turma de leo (u-1): um aluno (o de teste, que ainda não fez
    // o único exercício dela — é a sala com zero feitos) e um exercício
    // atribuído. Serve para ver a mesma conta nos dois mundos. `alunos` e
    // `atribuicoes` abaixo acompanham.
    {
      id: 'turma-5',
      professorId: 'u-1',
      nome: 'Oficina de digitação',
      totalAlunos: 1,
      totalExercicios: 1,
      periodo: '2026 · 1º semestre',
      capaSemente: 7549,
      ativa: true,
      dataCriacao: '2026-03-10',
    },
  ],

  // Mapa turmaId -> lista de alunos. RP2025045 nunca treinou (estado vazio).
  //
  // O `id` É o RP, e é o que identifica um aluno: a tabela Alunos tem ID
  // (o RP), SenhaHash, UserID e um Nome OPCIONAL (a coluna existe e aceita
  // nulo). O `nome` daqui é o que o back devolve: o da conta dona, ou o de
  // Alunos para aluno antigo (ver NOME DO ALUNO no cabeçalho).
  // RP2025043 é de ana e vem com o nome dela; RP2025049 também tem nome.
  // Os outros não têm conta semeada aqui nem nome em Alunos — é o caminho
  // "sem nome", em que a tela mostra o RP e NUNCA inventa um nome.
  //
  // `entrouEm` é a data em que ele entrou na turma (ClassMembers), e
  // `ultimaAtividade` é a data da última sessão — agregados prontos, como
  // wpmMedio e precisaoMedia já eram: o front não varre sessão para chegar
  // neles. Quem nunca treinou tem os quatro em null, e não em zero: zero
  // seria afirmar "treinou e fez 0 PPM".
  alunos: {
    'turma-1': [
      // Os agregados deste aluno são os DELE no sistema, somando as duas
      // turmas em que está — é o que /turmas/:id/alunos promete, e por
      // isso batem com as 12 sessões dele em `sessoes` (11 concluídas,
      // média 39 PPM e 91%, a última hoje). Não confundir com a linha que
      // o relatório do professor mostra para ele na turma-1: aquela é só
      // das sessões DA TURMA-1, e por isso marca outros números.
      {
        id: 'RP2025043',
        nome: 'Ana Pires',
        entrouEm: '2026-02-01',
        totalSessoes: 12,
        wpmMedio: 39,
        precisaoMedia: 91,
        ultimaAtividade: diasAtras(0),
      },
      {
        id: 'RP2025044',
        entrouEm: '2026-02-01',
        totalSessoes: 5,
        wpmMedio: 29,
        precisaoMedia: 88,
        ultimaAtividade: '2026-02-11T13:05:00.000Z',
      },
      // Nunca treinou: é a linha apagada, com travessão em todo número.
      {
        id: 'RP2025045',
        entrouEm: '2026-02-24',
        totalSessoes: 0,
        wpmMedio: null,
        precisaoMedia: null,
        ultimaAtividade: null,
      },
      // O único com Nome preenchido (a coluna é opcional): é por ele que se
      // vê a identificação em duas linhas — nome em cima, matrícula embaixo.
      // É também o de precisão média abaixo de 85%, o destaque discreto do
      // relatório. Treinou há 2 dias (ses-6), então entra em "alunos
      // ativos" em qualquer dia que a tela for aberta.
      {
        id: 'RP2025049',
        nome: 'Marina Duarte Alves',
        entrouEm: '2026-02-05',
        totalSessoes: 6,
        wpmMedio: 32,
        precisaoMedia: 78,
        ultimaAtividade: diasAtras(2),
      },
    ],
    'turma-2': [
      {
        id: 'RP2025046',
        entrouEm: '2026-02-10',
        totalSessoes: 3,
        wpmMedio: 41,
        precisaoMedia: 91,
        ultimaAtividade: '2026-02-20T16:45:00.000Z',
      },
      // A MESMA linha da turma-1: o aluno é um só, e estes agregados são
      // os dele no sistema. Só o `entrouEm` é desta turma.
      {
        id: 'RP2025043',
        nome: 'Ana Pires',
        entrouEm: '2026-02-12',
        totalSessoes: 12,
        wpmMedio: 39,
        precisaoMedia: 91,
        ultimaAtividade: diasAtras(0),
      },
      // Os colegas do ranking (ver COLEGAS_DO_RANKING, acima de `dados`).
      // Todos com nome: é assim que se vê que o nome do quarto lugar em
      // diante some no BACK — ele existe aqui e não chega à tela do aluno.
      ...COLEGAS_DO_RANKING.map(linhaDoColega),
    ],
    // Vazia de propósito — ver o comentário em `turmas`.
    'turma-3': [],
    'turma-4': [
      {
        id: 'RP2025047',
        entrouEm: '2026-03-02',
        totalSessoes: 7,
        wpmMedio: 33,
        precisaoMedia: 90,
        ultimaAtividade: '2026-03-09T11:20:00.000Z',
      },
      {
        id: 'RP2025048',
        entrouEm: '2026-03-02',
        totalSessoes: 0,
        wpmMedio: null,
        precisaoMedia: null,
        ultimaAtividade: null,
      },
    ],
    // A turma de leo: só o aluno de teste, que ainda não treinou nela.
    'turma-5': [
      {
        id: 'RP2025043',
        nome: 'Ana Pires',
        entrouEm: '2026-03-12',
        totalSessoes: 12,
        wpmMedio: 39,
        precisaoMedia: 91,
        ultimaAtividade: diasAtras(0),
      },
    ],
  },

  // Convites pendentes (ClassMembers com Status = 'convidado'). Um só, para
  // o aluno de teste: aceitar a turma-4 traz uma sala ainda sem
  // exercício. Aceito,
  // o convite sai daqui e a linha entra em `alunos`; recusado, só sai
  // daqui (o back grava Status = 'recusado'). O estado sem convite nenhum
  // é o de RP2025001, sem editar este arquivo.
  convites: [
    { turmaId: 'turma-4', alunoId: 'RP2025043', convidadoEm: diasAtras(2) },
  ],

  // 5 exercícios do professor (ExerciciosProf), no formato de GET
  // /exercicios — menos o atribuidoA, que é COUNT: sai de `atribuicoes` na
  // hora da resposta (ver comAtribuidoA), nunca de um número guardado aqui.
  // O conjunto cobre o que a biblioteca precisa mostrar: as três
  // dificuldades, tempo limite e "sem limite", um atribuído a várias turmas
  // (ex-prof-1: turma-1 e turma-3) e um a nenhuma (ex-prof-4).
  //
  // Nenhum texto tem quebra de linha: o motor de digitação trabalha com
  // uma linha contínua, e a biblioteca troca a quebra por espaço ao salvar.
  exercicios: [
    {
      id: 'ex-prof-1',
      professorId: 'u-2',
      titulo: 'Acentuação em foco',
      texto: TEXTOS.acentuacao,
      dificuldade: 'medio',
      tempoLimiteSegundos: 120,
    },
    {
      id: 'ex-prof-2',
      professorId: 'u-2',
      titulo: 'Números do cotidiano',
      texto: TEXTOS.numeros,
      dificuldade: 'medio',
      tempoLimiteSegundos: 0,
    },
    {
      id: 'ex-prof-3',
      professorId: 'u-2',
      titulo: 'Funções em JavaScript',
      // Uma linha só, de propósito — TEXTOS.codigo tem quebras.
      texto:
        'const media = (valores) => valores.length === 0 ? 0 : ' +
        'valores.reduce((total, n) => total + n, 0) / valores.length;',
      dificuldade: 'dificil',
      tempoLimiteSegundos: 180,
    },
    {
      id: 'ex-prof-4',
      professorId: 'u-2',
      titulo: 'Fileira de cima',
      texto:
        'Quero que o tio traga o pote de pirulito e o retrato do rei que tirou o tapete torto.',
      dificuldade: 'facil',
      tempoLimiteSegundos: 0,
    },
    {
      id: 'ex-prof-5',
      professorId: 'u-2',
      titulo: 'Frase curta',
      texto: TEXTOS.curto,
      dificuldade: 'facil',
      tempoLimiteSegundos: 45,
    },
    // O que o aluno de teste ainda NÃO fez: só na turma-1 e sem sessão
    // nenhuma, para a sala dele ter pendência e um "próximo" em destaque.
    {
      id: 'ex-prof-7',
      professorId: 'u-2',
      titulo: 'Linha-guia',
      texto: 'Asdf jklç, a linha do meio guia os dedos: sem olhar, eles voltam sempre para casa.',
      dificuldade: 'facil',
      tempoLimiteSegundos: 180,
    },
    // Cinco a mais, só na turma-1, para a sala dela ter 8 exercícios e a
    // trilha serpentear (4 por fileira, a segunda volta da direita). Os
    // dois primeiros da turma o aluno de teste já fez, o ex-prof-7 é o
    // próximo, e estes cinco são os seguintes: ninguém tem sessão neles.
    // Por isso não mexem nos agregados dos alunos nem nos relatórios da
    // turma-1, que só contam sessões; na visão do professor, cada pedra
    // destes diz "0 de 4".
    {
      id: 'ex-prof-8',
      professorId: 'u-2',
      titulo: 'Fileira de baixo',
      texto: 'Zebra, vaca e cobra: a fileira de baixo pede calma, um dedo de cada vez.',
      dificuldade: 'facil',
      tempoLimiteSegundos: 90,
    },
    {
      id: 'ex-prof-9',
      professorId: 'u-2',
      titulo: 'Pontuação',
      texto: 'Vírgula respira, ponto encerra; dois-pontos anunciam: e a pergunta termina assim?',
      dificuldade: 'medio',
      tempoLimiteSegundos: 120,
    },
    {
      id: 'ex-prof-10',
      professorId: 'u-2',
      titulo: 'Maiúsculas',
      texto: 'Em Belo Horizonte, Ana e Pedro leram O Pequeno Príncipe numa tarde de Março.',
      dificuldade: 'medio',
      tempoLimiteSegundos: 0,
    },
    {
      id: 'ex-prof-11',
      professorId: 'u-2',
      titulo: 'Datas e horários',
      texto: 'A prova é dia 12/06, às 7h45; a entrega vai até 19/06, às 23h59, sem atraso.',
      dificuldade: 'dificil',
      tempoLimiteSegundos: 150,
    },
    {
      id: 'ex-prof-12',
      professorId: 'u-2',
      titulo: 'Parágrafo final',
      texto:
        'Digitar bem é ritmo antes de pressa: olhos no texto, dedos em casa, e a velocidade chega sozinha com o tempo.',
      dificuldade: 'dificil',
      tempoLimiteSegundos: 0,
    },
    // O único exercício de leo (u-1). Não aparece na biblioteca de prof.
    {
      id: 'ex-prof-6',
      professorId: 'u-1',
      titulo: 'Aquecimento',
      texto: TEXTOS.curto,
      dificuldade: 'facil',
      tempoLimiteSegundos: 0,
    },
  ],

  // Mapa turmaId -> lista de { exerciseId, atribuidoEm, prazo }. Um prazo
  // preenchido e um null.
  //
  // Espelha a tabela AtribuicoesProf, cuja chave primária é o PAR
  // (ClassID, ExerciseID): não há id de atribuição, e por isso o mapa é
  // turma -> exercícios, e não uma lista de atribuições com id próprio.
  // `atribuidoEm` é a data em que o professor atribuiu — não confundir com
  // `prazo`, que é a data de entrega.
  atribuicoes: {
    'turma-1': [
      { exerciseId: 'ex-prof-1', atribuidoEm: '2026-02-03', prazo: '2026-03-15' },
      { exerciseId: 'ex-prof-2', atribuidoEm: '2026-02-17', prazo: null },
      { exerciseId: 'ex-prof-7', atribuidoEm: '2026-03-20', prazo: null },
      { exerciseId: 'ex-prof-8', atribuidoEm: '2026-03-24', prazo: null },
      { exerciseId: 'ex-prof-9', atribuidoEm: '2026-03-27', prazo: '2026-04-15' },
      { exerciseId: 'ex-prof-10', atribuidoEm: '2026-03-31', prazo: null },
      { exerciseId: 'ex-prof-11', atribuidoEm: '2026-04-03', prazo: null },
      { exerciseId: 'ex-prof-12', atribuidoEm: '2026-04-07', prazo: null },
    ],
    'turma-2': [
      { exerciseId: 'ex-prof-3', atribuidoEm: '2026-02-11', prazo: '2026-03-01' },
      { exerciseId: 'ex-prof-5', atribuidoEm: '2026-03-04', prazo: null },
    ],
    'turma-3': [
      { exerciseId: 'ex-prof-1', atribuidoEm: '2025-08-20', prazo: null },
      { exerciseId: 'ex-prof-2', atribuidoEm: '2025-08-20', prazo: null },
      { exerciseId: 'ex-prof-3', atribuidoEm: '2025-09-01', prazo: '2025-09-30' },
    ],
    // Vazia de propósito — ver o comentário na turma-4.
    'turma-4': [],
    'turma-5': [{ exerciseId: 'ex-prof-6', atribuidoEm: '2026-03-10', prazo: null }],
  },

  // Sessões do mundo Escola (SessionsProf). É a ÚNICA fonte dos relatórios
  // do professor: métricas da turma, linha de cada aluno, linha de cada
  // exercício e o histórico do modal saem todos daqui, agregados nas rotas
  // de /relatorio (ver os helpers de relatório na seção de Helpers).
  //
  // "Sessão da turma-1" é o JOIN: aluno matriculado nela E exercício
  // atribuído a ela (ex-prof-1 e ex-prof-2). Uma sessão do RP2025043 em
  // ex-prof-3 não apareceria no relatório da turma-1, e é isso que o back
  // real também faria.
  //
  // As datas dos últimos três são relativas a hoje (diasAtras): é o que
  // mantém "alunos ativos" — quem treinou nos últimos 7 dias — mostrando
  // algo diferente de zero em qualquer dia que a tela for aberta.
  sessoes: [
    {
      id: 'ses-1',
      exerciseId: 'ex-prof-1',
      alunoId: 'RP2025043',
      wpm: 40,
      precisao: 95,
      tempoSegundos: 58,
      acertos: 76,
      erros: 4,
      concluida: true,
      data: '2026-02-18T14:10:00.000Z',
    },
    {
      id: 'ses-2',
      exerciseId: 'ex-prof-2',
      alunoId: 'RP2025043',
      wpm: 36,
      precisao: 92,
      tempoSegundos: 61,
      acertos: 80,
      erros: 7,
      concluida: true,
      data: '2026-02-19T09:30:00.000Z',
    },
    {
      id: 'ses-3',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025046',
      wpm: 22,
      precisao: 80,
      tempoSegundos: 120,
      acertos: 60,
      erros: 15,
      concluida: false,
      data: '2026-02-20T16:45:00.000Z',
    },
    // RP2025044, turma-1: concluiu ex-prof-2 (que não tem tempo limite).
    {
      id: 'ses-4',
      exerciseId: 'ex-prof-2',
      alunoId: 'RP2025044',
      wpm: 29,
      precisao: 88,
      tempoSegundos: 96,
      acertos: 81,
      erros: 11,
      concluida: true,
      data: diasAtras(6),
    },
    // ESTOUROU O TEMPO: concluida = false em ex-prof-1, que tem tempo
    // limite de 120s. É a linha que faz a coluna "estouraram o tempo" da
    // aba Por exercício marcar 1 em vez de 0. O tempoSegundos bate no
    // limite justamente porque o tempo acabou antes do texto.
    {
      id: 'ses-5',
      exerciseId: 'ex-prof-1',
      alunoId: 'RP2025044',
      wpm: 24,
      precisao: 81,
      tempoSegundos: 120,
      acertos: 77,
      erros: 18,
      concluida: false,
      data: diasAtras(3),
    },
    // RP2025049: duas sessões concluídas, as duas com precisão baixa — é o
    // que põe a média dela em 78% e aciona o destaque de abaixo de 85%.
    {
      id: 'ses-6',
      exerciseId: 'ex-prof-1',
      alunoId: 'RP2025049',
      wpm: 33,
      precisao: 79,
      tempoSegundos: 104,
      acertos: 79,
      erros: 21,
      concluida: true,
      data: diasAtras(2),
    },
    {
      id: 'ses-7',
      exerciseId: 'ex-prof-2',
      alunoId: 'RP2025049',
      wpm: 30,
      precisao: 76,
      tempoSegundos: 131,
      acertos: 86,
      erros: 27,
      concluida: true,
      data: diasAtras(9),
    },

    // ------------------------------------------------------------------
    // O histórico do RP2025043 (pages/aluno/historico.html)
    // ------------------------------------------------------------------
    // Dez sessões na TURMA-2 (ex-prof-3 e ex-prof-5), somadas às duas de
    // fevereiro na turma-1 (ses-1 e ses-2): doze no total, que é o que a
    // tela de histórico precisa para mostrar tudo o que ela sabe mostrar.
    //
    // Ficam na turma-2 de propósito: assim o relatório da turma-1 — que é
    // o do professor, conferido linha por linha — não muda nem um número,
    // e o aluno ganha sessões em DUAS turmas, que é o que faz a coluna de
    // turma aparecer na tabela dele.
    //
    // O PPM sobe de 28 a 49 ao longo do tempo, e é isso que a linha de
    // evolução da tela lê (média das 5 mais recentes contra as 5
    // anteriores). Os três últimos dias são seguidos — d-2, d-1 e hoje —
    // para a "sequência" mostrar 3 em qualquer dia que a tela abrir.
    //
    // `turmaId` vem preenchido aqui (a coluna existe em SessionsProf); as
    // sessões antigas do seed não o têm, e para elas o mock descobre a
    // turma pelo mesmo JOIN que o back faria — ver turmaDaSessao().
    {
      id: 'ses-8',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 28,
      precisao: 84,
      tempoSegundos: 178,
      acertos: 126,
      erros: 24,
      concluida: true,
      data: diasAtras(26),
    },
    {
      id: 'ses-9',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 31,
      precisao: 86,
      tempoSegundos: 165,
      acertos: 129,
      erros: 21,
      concluida: true,
      data: diasAtras(22),
    },
    // A única não concluída dele: ex-prof-5 tem tempo limite de 45s e o
    // tempo acabou antes do texto. É a linha que a tabela mostra como
    // "Tempo esgotado" — nunca como falha.
    {
      id: 'ses-10',
      exerciseId: 'ex-prof-5',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 30,
      precisao: 82,
      tempoSegundos: 45,
      acertos: 41,
      erros: 9,
      concluida: false,
      data: diasAtras(18),
    },
    {
      id: 'ses-11',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 35,
      precisao: 88,
      tempoSegundos: 151,
      acertos: 125,
      erros: 17,
      concluida: true,
      data: diasAtras(14),
    },
    {
      id: 'ses-12',
      exerciseId: 'ex-prof-5',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 38,
      precisao: 89,
      tempoSegundos: 41,
      acertos: 40,
      erros: 5,
      concluida: true,
      data: diasAtras(10),
    },
    {
      id: 'ses-13',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 41,
      precisao: 91,
      tempoSegundos: 139,
      acertos: 131,
      erros: 13,
      concluida: true,
      data: diasAtras(6),
    },
    {
      id: 'ses-14',
      exerciseId: 'ex-prof-5',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 44,
      precisao: 90,
      tempoSegundos: 38,
      acertos: 36,
      erros: 4,
      concluida: true,
      data: diasAtras(4),
    },
    // Os três seguidos: anteontem, ontem e hoje.
    {
      id: 'ses-15',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 45,
      precisao: 93,
      tempoSegundos: 132,
      acertos: 133,
      erros: 10,
      concluida: true,
      data: diasAtras(2),
    },
    {
      id: 'ses-16',
      exerciseId: 'ex-prof-5',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 47,
      precisao: 94,
      tempoSegundos: 36,
      acertos: 47,
      erros: 3,
      concluida: true,
      data: diasAtras(1),
    },
    // A melhor marca dele nos dois números: 49 PPM e 96%.
    {
      id: 'ses-17',
      exerciseId: 'ex-prof-3',
      alunoId: 'RP2025043',
      turmaId: 'turma-2',
      wpm: 49,
      precisao: 96,
      tempoSegundos: 126,
      acertos: 144,
      erros: 6,
      concluida: true,
      data: diasAtras(0),
    },

    // As sessões dos colegas do ranking da turma-2, geradas (ver
    // sessoesDoColega): um dia seguido de treino por sessão, até hoje.
    ...COLEGAS_DO_RANKING.flatMap(sessoesDoColega),
  ],

  // Histórico de sessões do mundo Solo (mapa campanhaId -> lista).
  // Os exerciseId apontam para lições reais do percurso. O xpGanho de cada
  // uma bate com a regra de hoje: XP_BASE_MISSAO (50) mais o bônus
  // proporcional à precisão (50 + round(25 * precisao / 100)) quando
  // concluída, e 30% do base (15) quando o tempo esgotou — como a rota
  // POST /solo/sessoes calcula. A soma é o xpTotal da campanha (669).
  //
  // Dez sessões, com data RELATIVA a hoje (diasAtras), para a tela de
  // estatísticas ter o que mostrar sem ninguém editar este arquivo:
  //   · mais de 6 sessões — a evolução compara as 5 mais recentes (41, 39,
  //     38, 40, 36 → 38,8) com as 5 anteriores (34, 30, 31, 29, 27 → 30,2);
  //   · hoje, ontem, anteontem e três dias atrás — sequência de 4 dias
  //     (cinco dias atrás quebra);
  //   · lições dos níveis 1, 2, 3 e 4 — o filtro por nível tem opções;
  //   · uma não concluída (hs-6, solo-020) — "tempo esgotado" aparece como
  //     tentativa, e a lição segue contando como concluída por causa da
  //     hs-7.
  // A ordem aqui é da mais antiga para a mais recente, como o back grava;
  // quem precisa da ordem inversa ordena (utils/desempenho.ts).
  historicoSolo: {
    'camp-1': [
      // 50 + round(25 * 0,85) = 71
      { id: 'hs-1', exerciseId: 'solo-001', wpm: 27, precisao: 85, tempoSegundos: 132, acertos: 51, erros: 9, concluida: true, xpGanho: 71, data: diasAtras(15.4) },
      // 50 + round(25 * 0,89) = 72
      { id: 'hs-2', exerciseId: 'solo-002', wpm: 29, precisao: 89, tempoSegundos: 124, acertos: 57, erros: 7, concluida: true, xpGanho: 72, data: diasAtras(12.1) },
      // 50 + round(25 * 0,91) = 73
      { id: 'hs-3', exerciseId: 'solo-001', wpm: 31, precisao: 91, tempoSegundos: 116, acertos: 51, erros: 5, concluida: true, xpGanho: 73, data: diasAtras(9.3) },
      // 50 + round(25 * 0,86) = 72
      { id: 'hs-4', exerciseId: 'solo-001', wpm: 30, precisao: 86, tempoSegundos: 120, acertos: 49, erros: 8, concluida: true, xpGanho: 72, data: diasAtras(5.2) },
      // 50 + round(25 * 0,96) = 74
      { id: 'hs-5', exerciseId: 'solo-009', wpm: 34, precisao: 96, tempoSegundos: 104, acertos: 48, erros: 2, concluida: true, xpGanho: 74, data: diasAtras(3.1) },
      // tempo esgotou: round(50 * 0,3) = 15
      { id: 'hs-6', exerciseId: 'solo-020', wpm: 36, precisao: 84, tempoSegundos: 244, acertos: 58, erros: 11, concluida: false, xpGanho: 15, data: diasAtras(2.2) },
      // 50 + round(25 * 0,90) = 73
      { id: 'hs-7', exerciseId: 'solo-020', wpm: 40, precisao: 90, tempoSegundos: 236, acertos: 54, erros: 6, concluida: true, xpGanho: 73, data: diasAtras(1.4) },
      // 50 + round(25 * 0,95) = 74
      { id: 'hs-8', exerciseId: 'solo-009', wpm: 38, precisao: 95, tempoSegundos: 96, acertos: 57, erros: 3, concluida: true, xpGanho: 74, data: diasAtras(1.1) },
      // 50 + round(25 * 0,88) = 72
      { id: 'hs-9', exerciseId: 'solo-015', wpm: 39, precisao: 88, tempoSegundos: 88, acertos: 44, erros: 6, concluida: true, xpGanho: 72, data: diasAtras(0.3) },
      // 50 + round(25 * 0,92) = 73
      { id: 'hs-10', exerciseId: 'solo-015', wpm: 41, precisao: 92, tempoSegundos: 84, acertos: 46, erros: 4, concluida: true, xpGanho: 73, data: diasAtras(0.1) },
    ],
  },
};

// ============================================================================
// Helpers
// ============================================================================

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Envelope das listagens paginadas do contrato. O mock não fatia páginas —
// devolve tudo na página 1 —, mas a forma da resposta é a real, para a tela
// não ser construída em cima de um array puro que o back não devolve.
function paginado<T>(itens: T[]): Paginado<T> {
  return { total: itens.length, pagina: 1, itens };
}

const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toISOString();

// Data/hora relativa a AGORA. Existe por causa do "aluno ativo" dos
// relatórios, que olha os últimos 7 dias: com data fixa de fevereiro, essa
// métrica nasceria zerada e ficaria zerada para sempre, e o caminho
// "2 de 4" nunca apareceria na tela sem alguém editar este arquivo.
//
// Declaração de função, e não const: `dados` (acima) chama isto DENTRO do
// próprio literal, e só a declaração de função é içada até lá. Com
// `const diasAtras = ...` a carga do módulo morreria em ReferenceError.
function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString();
}

// Média inteira; null quando não há amostra (usado para "estado vazio").
function media(numeros: number[]): number | null {
  if (numeros.length === 0) return null;
  const soma = numeros.reduce((total, n) => total + n, 0);
  return Math.round(soma / numeros.length);
}

// Mesma ideia de `media()`, mas com 1 casa decimal — é o formato que o
// PPM médio do topo da tela de turma usa (ex.: 41.7), diferente do inteiro
// que /turmas/:id/relatorio devolve. Duas rotas, duas precisões: cada uma
// espelha o que a tela dela precisa mostrar.
function mediaDecimal(numeros: number[]): number | null {
  if (numeros.length === 0) return null;
  const soma = numeros.reduce((total, n) => total + n, 0);
  return Math.round((soma / numeros.length) * 10) / 10;
}

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// RP da conta nova: "RP" + 7 dígitos, sem repetir um que já existe.
// De verdade quem gera é o BACK, no POST /auth/cadastro; isto só imita.
function gerarRp(): string {
  const usados = new Set(CONTAS.map((c) => c.rp).filter(Boolean));
  let rp: string;
  do {
    rp = `RP${Math.floor(1000000 + Math.random() * 9000000)}`;
  } while (usados.has(rp));
  return rp;
}

// Senha de aluno da conta nova: 10 caracteres com pelo menos uma
// maiúscula, uma minúscula, um número e um símbolo. De verdade quem gera é
// o BACK; isto só imita. Os alfabetos deixam de fora o que se confunde ao
// copiar à mão (I, l, O, 0, 1).
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '#$%&*+?@!';

function sortearDe(alfabeto: string): string {
  return alfabeto[Math.floor(Math.random() * alfabeto.length)];
}

function gerarSenhaAluno(): string {
  const todos = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;
  const letras = [sortearDe(MAIUSCULAS), sortearDe(MINUSCULAS), sortearDe(DIGITOS), sortearDe(SIMBOLOS)];
  while (letras.length < 10) letras.push(sortearDe(todos));
  // Embaralha, senão toda senha começaria com maiúscula, minúscula, número
  // e símbolo, nessa ordem.
  return letras.sort(() => Math.random() - 0.5).join('');
}

function recalcularNivel(xpTotal: number): number {
  return Math.floor(xpTotal / dados.parametros.xpPorNivel) + 1;
}

// '/turmas/:turmaId/alunos/:alunoId' -> /^\/turmas\/([^/]+)\/alunos\/([^/]+)$/
function montarRegex(padrao: string): RegExp {
  return new RegExp('^' + padrao.replace(/:[A-Za-z]+/g, '([^/]+)') + '$');
}

// A campanha pelo id, se for da conta do token. De outra conta é o MESMO
// 404 de campanha que não existe: o 403 confirmaria que ela existe.
function campanhaDaConta(id: string, token: string | null | undefined): Campanha {
  const dono = contaDoToken(token).id;
  const campanha = dados.campanhas.find((c) => c.campanhaId === id && c.jogadorId === dono);
  if (!campanha) throw erro(404, 'Campanha não encontrada.', 'NAO_ENCONTRADO');
  return campanha;
}

// ----------------------------------------------------------------------------
// Dono — o WHERE ProfessorID = :conta que o back faz em toda rota do professor
// ----------------------------------------------------------------------------
// Turma ou exercício de OUTRA conta responde 404, o mesmo 404 de id
// inexistente: 403 confirmaria que o recurso existe, e isso já é
// informação de outra pessoa. Token de aluno aqui é 403 (contaDoToken):
// aluno não tem turma nem exercício "dele" neste sentido.

function turmaDaConta(id: string, token: string | null | undefined): Turma {
  const dono = contaDoToken(token).id;
  const turma = dados.turmas.find((t) => t.id === id && t.professorId === dono);
  if (!turma) throw erro(404, 'Turma não encontrada.', 'NAO_ENCONTRADO');
  return turma;
}

function exercicioDaConta(id: string, token: string | null | undefined): Exercicio {
  const dono = contaDoToken(token).id;
  const ex = dados.exercicios.find((e) => e.id === id && e.professorId === dono);
  if (!ex) throw erro(404, 'Exercício não encontrado.', 'NAO_ENCONTRADO');
  return ex;
}

// O JOIN Alunos_Turmas × AtribuicoesProf: o aluno está matriculado em
// `turmaId` E o exercício está atribuído a ela. Sem turma é 404 também: a
// sessão nasceria fora de qualquer turma. Um lugar só, para o GET do
// treino e o POST da sessão nunca discordarem sobre o que o aluno pode
// abrir e o que ele pode gravar — e o aluno descobrir na ABERTURA, não
// depois de digitar o texto inteiro.
function exercicioAtribuidoAoAluno(
  exercicioId: string,
  alunoId: string,
  turmaId: string | null | undefined
): Exercicio {
  const ex = dados.exercicios.find((e) => e.id === exercicioId);
  const atribuido =
    !!turmaId && matriculasDaTurma(turmaId).has(alunoId) && exerciciosDaTurma(turmaId).has(exercicioId);
  if (!ex || !atribuido) throw erro(404, 'Exercício não encontrado.', 'NAO_ENCONTRADO');
  return ex;
}

// Aluno: a turma vem da query (?turma=), posta por Treino.tsx. Conta: a
// query é ignorada, o filtro é o dono.
function exercicioVisivel(
  id: string,
  token: string | null | undefined,
  turmaId: string | null
): Exercicio {
  const usuario = usuarioDoToken(token);
  if (usuario?.tipo === 'aluno') return exercicioAtribuidoAoAluno(id, usuario.id, turmaId);
  return exercicioDaConta(id, token);
}

// Linha de aluno recém-chegado à turma (convite aceito). Tudo que é
// agregado nasce vazio, porque ele ainda não treinou nela.
function novoAluno(id: string): Aluno {
  return {
    id,
    entrouEm: hoje(),
    totalSessoes: 0,
    wpmMedio: null,
    precisaoMedia: null,
    ultimaAtividade: null,
  };
}

// Quantos alunos DA TURMA concluíram um exercício. Sai das sessões, não de
// um contador guardado: contador à parte é a primeira coisa a discordar do
// resto do mock depois de dois ou três DELETEs.
function concluintes(turmaId: string, exercicioId: string): number {
  const matriculas = new Set((dados.alunos[turmaId] ?? []).map((a) => a.id));
  const feitos = new Set(
    dados.sessoes
      .filter((se) => se.concluida && se.exerciseId === exercicioId && matriculas.has(se.alunoId))
      .map((se) => se.alunoId)
  );
  return feitos.size;
}

// Em quantas turmas um exercício está atribuído — o COUNT em AtribuicoesProf
// que o back faz em GET /exercicios. Contado na hora, pelo mesmo motivo de
// ----------------------------------------------------------------------------
// Relatórios — o JOIN que o back faria em SessionsProf
// ----------------------------------------------------------------------------
// As quatro rotas de /relatorio saem daqui, e todas da MESMA fonte: as
// sessões. Nada de contador guardado, nada de média escrita à mão em
// `dados` — se estes helpers e a tela discordarem, é bug de um dos dois, e
// não de duas verdades paralelas.
//
// "Sessão desta turma" é o JOIN de três tabelas: o aluno está matriculado
// nela (Alunos_Turmas) E o exercício está atribuído a ela (AtribuicoesProf).
// Não é pelo Sessao.turmaId: as sessões do seed não têm esse campo, e o
// back real também consegue a informação pelo JOIN.

// Janela de "aluno ativo". Quem decide qual é ela é o BACK — a tela recebe
// o número contado e não sabe (nem precisa saber) que são 7 dias.
const DIAS_ATIVO = 7;

function matriculasDaTurma(turmaId: string): Set<string> {
  return new Set((dados.alunos[turmaId] ?? []).map((a) => a.id));
}

function exerciciosDaTurma(turmaId: string): Set<string> {
  return new Set((dados.atribuicoes[turmaId] ?? []).map((a) => a.exerciseId));
}

// As sessões de UM aluno nesta turma, na ordem em que foram gravadas.
function sessoesDoAlunoNaTurma(turmaId: string, alunoId: string): Sessao[] {
  const exercicios = exerciciosDaTurma(turmaId);
  return dados.sessoes.filter((s) => s.alunoId === alunoId && exercicios.has(s.exerciseId));
}

// A data mais recente de uma lista de sessões. ISO ordena como texto, então
// não precisa de Date() no meio.
function ultimaData(sessoes: Sessao[]): string | null {
  return sessoes.map((s) => s.data).sort().pop() ?? null;
}

function treinouNosUltimosDias(iso: string | null, dias: number): boolean {
  if (!iso) return false;
  return Date.now() - Date.parse(iso) <= dias * 86400000;
}

// Uma linha da aba "Por aluno". Os agregados são DA TURMA: só as sessões
// dela entram. Um aluno em duas turmas tem um relatório em cada uma — e é
// por isso que estes números podem diferir dos de /turmas/:id/alunos, que
// são os do aluno no sistema todo.
function linhaPorAluno(turmaId: string, aluno: Aluno, atribuidos: number): RelatorioAluno {
  const minhas = sessoesDoAlunoNaTurma(turmaId, aluno.id);
  const concluidas = minhas.filter((s) => s.concluida);
  return {
    ...aluno,
    totalSessoes: minhas.length,
    // media() devolve null sem amostra: quem nunca concluiu nada fica com
    // null, não com zero — zero afirmaria "treinou e fez 0 PPM".
    wpmMedio: media(concluidas.map((s) => s.wpm)),
    precisaoMedia: media(concluidas.map((s) => s.precisao)),
    ultimaAtividade: ultimaData(minhas),
    // Exercícios DISTINTOS concluídos: repetir o mesmo exercício não conta
    // duas vezes. Este é COUNT, não média — zero aqui é zero mesmo.
    exerciciosConcluidos: new Set(concluidas.map((s) => s.exerciseId)).size,
    exerciciosAtribuidos: atribuidos,
  };
}

// Uma linha da aba "Por exercício". `concluidoPor` reaproveita o mesmo
// concluintes() de /turmas/:id/atribuicoes: um número, um lugar.
function linhaPorExercicio(
  turmaId: string,
  atribuicao: Atribuicao,
  totalAlunos: number,
  matriculas: Set<string>
): RelatorioExercicio | null {
  const ex = dados.exercicios.find((e) => e.id === atribuicao.exerciseId);
  if (!ex) return null;

  const daTurma = dados.sessoes.filter(
    (s) => s.exerciseId === ex.id && matriculas.has(s.alunoId)
  );
  const concluidas = daTurma.filter((s) => s.concluida);

  return {
    exercicioId: ex.id,
    titulo: ex.titulo,
    dificuldade: ex.dificuldade,
    atribuidoEm: atribuicao.atribuidoEm ?? null,
    concluidoPor: concluintes(turmaId, ex.id),
    totalAlunos,
    wpmMedio: media(concluidas.map((s) => s.wpm)),
    precisaoMedia: media(concluidas.map((s) => s.precisao)),
    // Sem tempo limite não há tempo para estourar: 0, sempre. Uma sessão
    // não concluída num exercício sem limite é outra coisa (o aluno
    // desistiu), e não pode ser contada como estouro.
    estouraramTempo: ex.tempoLimiteSegundos > 0 ? daTurma.length - concluidas.length : 0,
  };
}

// ----------------------------------------------------------------------------
// Histórico do aluno — as sessões dele, em todas as turmas
// ----------------------------------------------------------------------------

// A turma de uma sessão. SessionsProf tem a coluna (as sessões novas e as
// gravadas pelo POST vêm com ela preenchida); as do seed antigo não têm, e
// para essas o mock descobre pelo mesmo JOIN que o back faria — a turma em
// que o aluno está E que tem aquele exercício atribuído. Null quando nem o
// JOIN resolve: melhor "—" na coluna do que uma turma escolhida a esmo.
function turmaDaSessao(sessao: Sessao): Turma | null {
  if (sessao.turmaId) return dados.turmas.find((t) => t.id === sessao.turmaId) ?? null;

  const candidatas = dados.turmas.filter(
    (t) =>
      (dados.alunos[t.id] ?? []).some((a) => a.id === sessao.alunoId) &&
      (dados.atribuicoes[t.id] ?? []).some((a) => a.exerciseId === sessao.exerciseId)
  );
  // Ambíguo (o mesmo exercício atribuído a duas turmas dele) é o mesmo que
  // não saber: no back a coluna responderia, e aqui não se adivinha.
  return candidatas.length === 1 ? candidatas[0] : null;
}

// Todas as sessões de um aluno, sem recorte de turma — é o que a tela de
// histórico mostra. Ordenadas da mais recente para a mais antiga, que é a
// ordem do contrato.
function historicoDoAluno(alunoId: string): SessaoDoHistorico[] {
  return dados.sessoes
    .filter((s) => s.alunoId === alunoId)
    .map((s) => ({
      ...s,
      // Os dois JOINs: título do exercício e nome da turma.
      tituloExercicio: dados.exercicios.find((e) => e.id === s.exerciseId)?.titulo ?? null,
      nomeTurma: turmaDaSessao(s)?.nome ?? null,
    }))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

// ----------------------------------------------------------------------------
// As salas do aluno (/aluno/salas)
// ----------------------------------------------------------------------------
// "Sala" é a turma vista pelo aluno. Turma arquivada não aparece: não há
// mais o que fazer nela, e o histórico continua mostrando as sessões.

function salasDoAluno(alunoId: string): Turma[] {
  return dados.turmas.filter(
    (t) => t.ativa && (dados.alunos[t.id] ?? []).some((a) => a.id === alunoId)
  );
}

// O nome da conta dona da turma. Vale também para conta criada no cadastro.
function nomeDoProfessor(professorId: string): string | null {
  const conta = CONTAS.find((c) => c.usuario.tipo === 'conta' && c.usuario.id === professorId);
  return conta?.usuario.nome ?? null;
}

// As sessões dele que contam para ESTA sala: exercício atribuído a ela e,
// quando a sessão diz a turma, que seja esta — o mesmo exercício pode
// estar em duas salas dele, e o treino de uma não conta na outra.
function sessoesNaSala(turmaId: string, alunoId: string): Sessao[] {
  return sessoesDoAlunoNaTurma(turmaId, alunoId).filter((s) => !s.turmaId || s.turmaId === turmaId);
}

function estadoDoExercicio(sessoes: Sessao[]): EstadoExercicioDaSala {
  if (sessoes.length === 0) return 'nao_feito';
  return sessoes.some((s) => s.concluida) ? 'feito' : 'tempo_esgotado';
}

function exerciciosDaSala(turmaId: string, alunoId: string): ExercicioDaSala[] {
  const sessoes = sessoesNaSala(turmaId, alunoId);
  const lista: ExercicioDaSala[] = [];
  for (const atribuicao of dados.atribuicoes[turmaId] ?? []) {
    const ex = dados.exercicios.find((e) => e.id === atribuicao.exerciseId);
    if (!ex) continue;
    const doExercicio = sessoes.filter((s) => s.exerciseId === ex.id);
    // A marca que aparece é a melhor das concluídas; sem nenhuma
    // concluída, a melhor das vezes em que o tempo acabou.
    const concluidas = doExercicio.filter((s) => s.concluida);
    const contam = concluidas.length ? concluidas : doExercicio;
    lista.push({
      id: ex.id,
      titulo: ex.titulo,
      dificuldade: ex.dificuldade,
      caracteres: ex.texto.length,
      tempoLimiteSegundos: ex.tempoLimiteSegundos,
      atribuidoEm: atribuicao.atribuidoEm ?? null,
      prazo: atribuicao.prazo,
      estado: estadoDoExercicio(doExercicio),
      melhorWpm: contam.length ? Math.max(...contam.map((s) => s.wpm)) : null,
      melhorPrecisao: contam.length ? Math.max(...contam.map((s) => s.precisao)) : null,
      ultimaSessao: ultimaData(doExercicio),
    });
  }
  return lista;
}

function resumoDaSala(turma: Turma, alunoId: string): SalaDoAluno {
  const lista = exerciciosDaSala(turma.id, alunoId);
  return {
    id: turma.id,
    nome: turma.nome,
    professor: nomeDoProfessor(turma.professorId),
    capaSemente: turma.capaSemente,
    totalAlunos: (dados.alunos[turma.id] ?? []).length,
    exerciciosFeitos: lista.filter((ex) => ex.estado !== 'nao_feito').length,
    exerciciosTotal: lista.length,
  };
}

// A sala, se ele estiver nela; senão 404 — e não 403. "Não é sua" e "não
// existe" dão a mesma resposta: o 403 confirmaria, a quem tenta ids, que
// aquela turma existe.
function salaDoToken(turmaId: string, token: string | null | undefined): { turma: Turma; aluno: Usuario } {
  const aluno = alunoDoToken(token);
  const turma = salasDoAluno(aluno.id).find((t) => t.id === turmaId);
  if (!turma) throw erro(404, 'Sala não encontrada.', 'NAO_ENCONTRADO');
  return { turma, aluno };
}

// ----------------------------------------------------------------------------
// Relatório individual e ranking da sala (o lado do aluno)
// ----------------------------------------------------------------------------

// Abaixo disto, a média de uma pessoa não diz nada: uma sessão ruim (ou
// boa) decide tudo. A tela mostra quanto falta em vez de um número.
const MINIMO_DE_SESSOES = 3;

// O que a sala sabe de um aluno: lições (exercícios DIFERENTES concluídos),
// ritmo (PPM médio das concluídas) e dias seguidos. Só sessões da sala.
function numerosNaSala(turmaId: string, alunoId: string) {
  const sessoes = sessoesNaSala(turmaId, alunoId);
  const concluidas = sessoes.filter((s) => s.concluida);
  return {
    concluidas,
    licoes: new Set(concluidas.map((s) => s.exerciseId)).size,
    ritmo: media(concluidas.map((s) => s.wpm)),
    diasSeguidos: sequenciaDeDias(sessoes),
  };
}

// O ranking das salas do aluno de teste, como o back o devolve: já em
// ordem e já com os pontos. A fórmula (e quem calcula) é do back — ver o
// comentário de rankingDaTurma em api.ts. Os números aqui batem com as
// sessões semeadas: são os que aquela fórmula daria sobre elas.
//
// Turma sem entrada aqui (ex.: a turma-4, depois de aceito o convite):
// todos os membros com zero, como uma turma em que ninguém treinou.
interface LinhaPronta {
  alunoId: string;
  licoes: number;
  ritmo: number | null;
  diasSeguidos: number;
  pontos: number;
}

const RANKING_PRONTO: Record<string, LinhaPronta[]> = {
  'turma-1': [
    { alunoId: 'RP2025043', licoes: 2, ritmo: 38, diasSeguidos: 0, pontos: 78 },
    { alunoId: 'RP2025049', licoes: 2, ritmo: 32, diasSeguidos: 0, pontos: 72 },
    { alunoId: 'RP2025044', licoes: 1, ritmo: 29, diasSeguidos: 0, pontos: 49 },
    { alunoId: 'RP2025045', licoes: 0, ritmo: null, diasSeguidos: 0, pontos: 0 },
  ],
  'turma-2': [
    { alunoId: 'RP2025050', licoes: 2, ritmo: 46, diasSeguidos: 12, pontos: 146 },
    { alunoId: 'RP2025051', licoes: 2, ritmo: 44, diasSeguidos: 10, pontos: 134 },
    { alunoId: 'RP2025052', licoes: 2, ritmo: 47, diasSeguidos: 9, pontos: 132 },
    { alunoId: 'RP2025053', licoes: 2, ritmo: 42, diasSeguidos: 8, pontos: 122 },
    { alunoId: 'RP2025054', licoes: 2, ritmo: 43, diasSeguidos: 7, pontos: 118 },
    { alunoId: 'RP2025043', licoes: 2, ritmo: 40, diasSeguidos: 3, pontos: 95 },
    { alunoId: 'RP2025055', licoes: 2, ritmo: 31, diasSeguidos: 3, pontos: 86 },
    { alunoId: 'RP2025046', licoes: 0, ritmo: null, diasSeguidos: 0, pontos: 0 },
  ],
  'turma-5': [{ alunoId: 'RP2025043', licoes: 0, ritmo: null, diasSeguidos: 0, pontos: 0 }],
};

// As linhas prontas da turma, só de quem ainda é membro, e quem não tem
// linha no fim, zerado.
function rankingDaTurma(turmaId: string): LinhaPronta[] {
  const membros = (dados.alunos[turmaId] ?? []).map((a) => a.id);
  const prontas = (RANKING_PRONTO[turmaId] ?? []).filter((l) => membros.includes(l.alunoId));
  const semLinha = membros
    .filter((id) => !prontas.some((l) => l.alunoId === id))
    .map((alunoId) => ({ alunoId, licoes: 0, ritmo: null, diasSeguidos: 0, pontos: 0 }));
  return [...prontas, ...semLinha];
}

// ----------------------------------------------------------------------------
// Convites pelo RP (o lado do professor)
// ----------------------------------------------------------------------------

const FORMATO_RP = /^RP\d{7}$/;

// Como o login: aceita espaço e minúscula, e guarda na forma do banco.
function normalizarRp(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, '').toUpperCase();
}

// Onde o RP está nesta turma: ativo, convidado, ou em lugar nenhum (null).
function estadoNaTurma(turmaId: string, rp: string): EstadoNaTurma | null {
  if ((dados.alunos[turmaId] ?? []).some((a) => a.id === rp)) return 'ativo';
  if (dados.convites.some((c) => c.turmaId === turmaId && c.alunoId === rp)) return 'convidado';
  return null;
}

// O nome de quem tem este RP: o da conta dona (ver NOME DO ALUNO).
function nomeDoRp(rp: string): string | null {
  return CONTAS.find((c) => c.rp === rp)?.usuario.nome ?? null;
}

function convidadoDaTurma(convite: ConviteMock): ConvidadoDaTurma {
  return {
    estado: 'convidado',
    id: convite.alunoId,
    nome: nomeDoRp(convite.alunoId),
    convidadoEm: convite.convidadoEm,
  };
}

// Cria o convite ou diz por que não dá. Um lugar só para o convite um por
// um e para o lote: os dois têm de recusar pelos mesmos motivos.
// meuRp é o RP da conta dona do token: ninguém convida a si mesmo.
function convidarRp(turmaId: string, rp: string, meuRp: string | null): ConvidadoDaTurma {
  if (!FORMATO_RP.test(rp)) throw erro(400, 'RP fora do formato.', 'RP_INVALIDO');
  if (rp === meuRp) throw erro(400, 'Você não pode convidar a si mesmo', 'CONVITE_PROPRIO');
  const estado = estadoNaTurma(turmaId, rp);
  if (estado === 'ativo') throw erro(409, 'Este RP já está na turma.', 'JA_NA_TURMA');
  if (estado === 'convidado') throw erro(409, 'Este RP já foi convidado.', 'JA_CONVIDADO');
  // O mesmo 404 para "não existe" e "existe mas é de outra pessoa" não se
  // aplica aqui: o RP é público por natureza (o aluno o passa adiante).
  if (!CONTAS.some((c) => c.rp === rp)) throw erro(404, 'Nenhuma conta com esse RP.', 'RP_NAO_ENCONTRADO');
  const convite: ConviteMock = { turmaId, alunoId: rp, convidadoEm: agora() };
  dados.convites.push(convite);
  return convidadoDaTurma(convite);
}

// O convite pendente deste aluno para esta turma, ou 404: já respondido,
// cancelado pelo professor, ou nunca existiu — para o aluno é tudo igual.
function exigirConvite(turmaId: string, alunoId: string): ConviteMock {
  const convite = dados.convites.find((c) => c.turmaId === turmaId && c.alunoId === alunoId);
  if (!convite) throw erro(404, 'Convite não encontrado.', 'NAO_ENCONTRADO');
  return convite;
}

function tirarConvite(convite: ConviteMock): void {
  dados.convites = dados.convites.filter((c) => c !== convite);
}

// concluintes(): um número guardado é o primeiro a discordar do resto.
function comAtribuidoA(ex: Exercicio): Exercicio {
  const atribuidoA = Object.values(dados.atribuicoes).filter((lista) =>
    lista.some((a) => a.exerciseId === ex.id)
  ).length;
  return { ...ex, atribuidoA };
}

// ============================================================================
// 5. erro(status, mensagem, codigo)
// ============================================================================
// Devolve um Error com os mesmos getters que o ErroApi do api.js expõe, para
// a tela tratar a falha do mock igual à falha da API real.

export function erro(status: number, mensagem: string, codigo: string | null = null): ErroDaApi {
  // `as`: o Error nasce sem status/codigo/getters e ganha um a um abaixo.
  // Não há como o tsc acompanhar essa montagem incremental sem a anotação.
  const e = new Error(mensagem) as ErroDaApi;
  e.name = 'ErroApi';
  e.status = status;
  e.codigo = codigo;
  Object.defineProperties(e, {
    ehAutenticacao: { get: () => status === 401 },
    ehPermissao: { get: () => status === 403 },
    ehConflito: { get: () => status === 409 },
    ehRede: { get: () => status === 0 },
  });
  return e;
}

// ============================================================================
// 5b. CONTAS — credenciais de teste
// ============================================================================
// O "banco de senhas" do mock. Senha em texto puro aqui é proposital: é o
// único jeito de comparar sem hash, e este arquivo nunca vai para produção
// (some junto com CONFIG.MOCK = false).
//
// `ativo` espelha a coluna Ativo da tabela Users. Mude para false e aquela
// conta passa a responder 403 ("Esta conta está desativada") em vez de
// entrar — é assim que se testa esse caminho na tela.

// Duas formas de linha, uma por tabela:
//   conta (Users)  -> email e senha;
//   aluno (Alunos) -> rp e a senha de ALUNO, mais o userId da conta dona
//                     (a coluna UserID que Alunos vai ganhar).
interface Conta {
  email?: string;
  rp?: string;
  userId?: string;
  senha: string;
  ativo: boolean;
  usuario: Usuario;
}

// A senha de aluno das entradas de teste. As de verdade são geradas pelo
// back (ver gerarSenhaAluno); esta segue a mesma regra — maiúscula,
// minúscula, número e símbolo — para ser uma senha que o back geraria.
const SENHA_ALUNO_DE_TESTE = 'Aluno#2025';

// Entrada de aluno de uma conta que ainda não está em sala nenhuma. O nome
// é o da conta dona (ver NOME DO ALUNO no cabeçalho).
function alunoSemSala(rp: string, nome: string | null): Usuario {
  return { id: rp, nome, tipo: 'aluno', turmas: [] };
}

const CONTAS: Conta[] = [
  { email: 'leo@teclar.dev', senha: 'senha123', ativo: true, usuario: USUARIOS.leo },
  // Segunda conta, sem campanha nenhuma: é ela que mostra o estado de
  // convite do lobby do Solo. Ver o cabeçalho deste arquivo.
  { email: 'ana@teclar.dev', senha: 'senha123', ativo: true, usuario: USUARIOS.ana },
  { email: 'prof@teclar.dev', senha: 'senha123', ativo: true, usuario: USUARIOS.prof },

  // Toda conta tem a sua entrada de aluno. Aluno entra pelo RP (o ID da
  // tabela Alunos), nunca por e-mail. A de ana é o aluno de teste.
  { rp: 'RP2025043', userId: USUARIOS.ana.id, senha: SENHA_ALUNO_DE_TESTE, ativo: true, usuario: USUARIOS.aluno },
  { rp: 'RP2025001', userId: USUARIOS.leo.id, senha: SENHA_ALUNO_DE_TESTE, ativo: true, usuario: alunoSemSala('RP2025001', USUARIOS.leo.nome) },
  { rp: 'RP2025002', userId: USUARIOS.prof.id, senha: SENHA_ALUNO_DE_TESTE, ativo: true, usuario: alunoSemSala('RP2025002', USUARIOS.prof.nome) },
];

// O RP da conta: a linha de Alunos cujo UserID aponta para ela.
function rpDaConta(contaId: string): string | null {
  return CONTAS.find((c) => c.userId === contaId)?.rp ?? null;
}

const normalizarEmail = (valor: unknown): string => String(valor ?? '').trim().toLowerCase();

// O começo fixo do token de uma sessão. O id entra aqui porque o token
// precisa dizer QUEM está pedindo, e não só de que tipo: leo e ana são as
// duas contas e têm campanhas diferentes — uma tem, a outra não. Só com o
// tipo, /solo/campanha responderia a mesma coisa para as duas e o estado
// de convite do lobby nunca apareceria.
function prefixoToken(usuario: Usuario): string {
  return `mock-${usuario.tipo}-${usuario.id}-token-`;
}

// Token falso, mas com a forma de um: a tela não olha o conteúdo, só manda
// de volta no Authorization.
function sessaoDe(usuario: Usuario): RespostaLogin {
  return { token: `${prefixoToken(usuario)}${Date.now().toString(36)}`, usuario };
}

// De quem é este token. Compara pelo prefixo em vez de fatiar a string:
// o id pode ter hífen ('u-1') e qualquer parse por '-' erraria. Devolve
// null para token que o mock não emitiu — inclusive os do formato antigo,
// sem id, que possam ter ficado no localStorage de antes desta mudança
// (basta entrar de novo).
function usuarioDoToken(token: string | null | undefined): Usuario | null {
  if (typeof token !== 'string') return null;
  return CONTAS.find((c) => token.startsWith(prefixoToken(c.usuario)))?.usuario ?? null;
}

// 401 sempre com a MESMA mensagem, existindo a conta ou não: dizer "e-mail
// não cadastrado" entrega quem tem conta no sistema para quem perguntar.
function exigirConta(conta: Conta | undefined): RespostaLogin {
  if (!conta) throw erro(401, 'Credenciais inválidas.', 'CREDENCIAIS');
  if (!conta.ativo) throw erro(403, 'Conta desativada.', 'CONTA_INATIVA');
  return sessaoDe(conta.usuario);
}

// A sessão pelo id, só se for de quem pede: token de aluno lê as sessões
// Escola DELE; token de conta lê as sessões Solo da campanha DELA. É a rota
// do F5 da tela de resultado — sem esta checagem, qualquer pessoa logada
// leria o treino de outra trocando o ?sessao= da URL. Sessão de outra
// pessoa é o MESMO 404 de sessão que não existe.
function sessaoDoToken(id: string, token: string | null | undefined): Sessao | SessaoSolo {
  const usuario = usuarioDoToken(token);
  if (usuario?.tipo === 'aluno') {
    const daEscola = dados.sessoes.find((s) => s.id === id && s.alunoId === usuario.id);
    if (daEscola) return daEscola;
  }
  if (usuario?.tipo === 'conta') {
    const campanha = campanhaDoJogador(usuario.id);
    const doSolo = campanha && (dados.historicoSolo[campanha.campanhaId] ?? []).find((h) => h.id === id);
    if (doSolo) return doSolo;
  }
  throw erro(404, 'Sessão não encontrada.', 'NAO_ENCONTRADO');
}

// Quem pode mexer em categorias e parâmetros globais. A tabela Users não
// tem coluna de papel, então o back ainda precisa de um lugar para dizer
// quem é administrador (ver @coluna-pendente em api.ts). Até lá, a lista
// é explícita e VAZIA: nenhuma conta semeada é administradora, e nenhuma
// tela de administração existe. Para testar o caminho de sucesso, ponha
// aqui o id de uma conta (ex.: 'u-2').
const ADMINISTRADORES: string[] = [];

// Token que não é de administrador: 404, como recurso que não existe —
// para conta comum, estas rotas de escrita simplesmente não existem.
function exigirAdministrador(token: string | null | undefined): void {
  const usuario = usuarioDoToken(token);
  if (usuario?.tipo !== 'conta' || !ADMINISTRADORES.includes(usuario.id)) {
    throw erro(404, 'Recurso não encontrado.', 'NAO_ENCONTRADO');
  }
}

// ============================================================================
// 6. rotas — [método, regex, handler(params, corpo)]
// ============================================================================
// As mais específicas vêm antes das genéricas. `params` é o array de trechos
// capturados na ordem em que aparecem na URL.

// `corpo` é any de propósito: é o req.body cru, e cada handler lê dele o
// que a rota espera — exatamente como um back faz antes de validar.
//
// `token` chega para as rotas que precisam saber QUEM está pedindo, e não
// só o que foi pedido: as de /aluno/ tiram o AlunoID dele em vez de aceitar
// uma matrícula por parâmetro. Quase todo handler ignora este argumento.
type Handler = (
  params: string[],
  corpo?: any,
  token?: string | null,
  query?: URLSearchParams
) => unknown;

// Qual aluno o token representa. O mock não assina nada — confere só o
// formato dos tokens que ele mesmo emite (ver sessaoDe) —, mas o CAMINHO é
// o real: quem diz de quem é o histórico é o token, nunca a URL. Token de
// conta aqui é 403, não "histórico vazio".
function alunoDoToken(token: string | null | undefined): Usuario {
  const usuario = usuarioDoToken(token);
  if (usuario?.tipo !== 'aluno') {
    throw erro(403, 'Estas rotas são do aluno logado.', 'TIPO_INVALIDO');
  }
  return usuario;
}

// O mesmo caminho para o mundo Solo: quem diz de quem é a campanha é o
// token, nunca a URL. Token de aluno aqui é 403, não "campanha nenhuma" —
// senão o lobby mostraria o convite de começar para quem nem devia estar
// na tela. Qualquer CONTA passa: Solo não é permissão, é modo.
function contaDoToken(token: string | null | undefined): Usuario {
  const usuario = usuarioDoToken(token);
  if (usuario?.tipo !== 'conta') {
    throw erro(403, 'Estas rotas são da conta logada.', 'TIPO_INVALIDO');
  }
  return usuario;
}

// A campanha do jogador, ou undefined quando ele ainda não começou.
// Um jogador, uma campanha: o find para na primeira de propósito.
function campanhaDoJogador(jogadorId: string): Campanha | undefined {
  return dados.campanhas.find((c) => c.jogadorId === jogadorId);
}

// A campanha do token, para as rotas de sub-recurso (histórico,
// estatísticas) que não recebem id na URL. Sem campanha é o MESMO 404 de
// acharCampanha — a rota por id respondia assim, e a troca de id por token
// não muda o que "campanha inexistente" quer dizer. Só GET /solo/campanha
// devolve null, porque lá a ausência é o estado de primeira vez do lobby.
function campanhaDoToken(token: string | null | undefined): Campanha {
  const campanha = campanhaDoJogador(contaDoToken(token).id);
  if (!campanha) throw erro(404, 'Campanha não encontrada.', 'NAO_ENCONTRADO');
  return campanha;
}

const rotas: [string, RegExp, Handler][] = [
  // --- auth --------------------------------------------------------------
  // Um endpoint só. O corpo é que diz a tabela: { perfil: 'Aluno', rp,
  // senha } vai em Alunos; { email, senha } vai em Users. O `tipo` da
  // resposta é de onde a conta foi achada — não do que a tela mandou.
  [
    'POST',
    montarRegex('/auth/login'),
    (params, corpo) => {
      // As pontas da senha são aparadas, como o back faz: o cadastro não
      // aceita senha com espaço nas pontas, então nenhuma senha certa muda.
      const senha = String(corpo?.senha ?? '').trim();

      if (corpo?.perfil === 'Aluno') {
        // O back aceita o RP com espaço ou minúsculo, como a tela.
        const rp = String(corpo?.rp ?? '').replace(/\s+/g, '').toUpperCase();
        return exigirConta(CONTAS.find((c) => c.rp === rp && c.senha === senha));
      }

      const email = normalizarEmail(corpo?.email);
      return exigirConta(CONTAS.find((c) => normalizarEmail(c.email) === email && c.senha === senha));
    },
  ],

  // Cadastro: cria a conta e já devolve a sessão pronta, como o login, mais
  // a entrada de aluno da conta: { rp, senhaAluno }. Esta é a ÚNICA
  // resposta em que senhaAluno aparece.
  [
    'POST',
    montarRegex('/auth/cadastro'),
    (params, corpo) => {
      const email = normalizarEmail(corpo?.email);

      // O login apara as pontas da senha antes de enviar: uma senha
      // gravada com espaço na ponta nunca mais bateria. A tela já barra
      // isso (validarSenha); aqui o mock barra como o back vai barrar.
      const senha = String(corpo?.senha ?? '');
      if (senha !== senha.trim()) {
        throw erro(400, 'A senha não pode começar nem terminar com espaço.', 'DADOS_INVALIDOS');
      }

      // 409 é o erro que a tela mostra NO CAMPO do e-mail, com link para o
      // login. leo@teclar.dev é o caminho garantido para testar isso.
      if (CONTAS.some((c) => normalizarEmail(c.email) === email)) {
        throw erro(409, 'E-mail já cadastrado.', 'EMAIL_EM_USO');
      }

      const usuario: Usuario = {
        id: gerarId('u'),
        nome: String(corpo?.nome ?? '').trim(),
        email: String(corpo?.email ?? '').trim(),
        tipo: 'conta',
      };

      // A linha de Alunos da conta nova nasce junto, na mesma hora.
      const rp = gerarRp();
      const senhaAluno = gerarSenhaAluno();

      // Entra no "banco" em memória: dá para sair e entrar de novo com a
      // conta recém-criada — como conta e como aluno —, até o próximo F5.
      CONTAS.push({ email: usuario.email, senha: corpo?.senha, ativo: true, usuario });
      CONTAS.push({ rp, userId: usuario.id, senha: senhaAluno, ativo: true, usuario: alunoSemSala(rp, usuario.nome) });

      const resposta: RespostaCadastro = { ...sessaoDe(usuario), rp, senhaAluno };
      return resposta;
    },
  ],

  // --- conta ---------------------------------------------------------------
  // O RP da conta do token. Nunca recebe id: é sempre o da própria conta.
  ['GET', montarRegex('/conta/rp'), (params, corpo, token) => ({ rp: rpDaConta(contaDoToken(token).id) })],

  // Senha de aluno nova para a conta do token. A antiga deixa de valer na
  // hora, e a nova só aparece nesta resposta.
  [
    'POST',
    montarRegex('/conta/rp/nova-senha'),
    (params, corpo, token) => {
      const conta = contaDoToken(token);
      const entrada = CONTAS.find((c) => c.userId === conta.id);
      if (!entrada) throw erro(404, 'Esta conta ainda não tem RP.', 'NAO_ENCONTRADO');
      entrada.senha = gerarSenhaAluno();
      return { senhaAluno: entrada.senha };
    },
  ],

  // Quem é o dono do token: conta ou aluno, como o login devolveu.
  [
    'GET',
    montarRegex('/auth/eu'),
    (params, corpo, token) => {
      const usuario = usuarioDoToken(token);
      if (!usuario) throw erro(401, 'Token inválido ou expirado.', 'TOKEN_INVALIDO');
      return usuario;
    },
  ],
  ['POST', montarRegex('/auth/logout'), () => null],

  // --- solo: a campanha do jogador logado (singular) ---------------------
  // Sem id na URL: o dono sai do token. Estas duas rotas substituíram a
  // listagem GET /solo/campanhas e o POST /solo/campanhas com corpo.

  // Devolve null — não 404 — quando o jogador ainda não começou. É o
  // estado de primeira vez do lobby, e estado não é erro: 404 obrigaria a
  // tela a ler o convite dentro de um catch.
  [
    'GET',
    montarRegex('/solo/campanha'),
    (params, corpo, token) => campanhaDoJogador(contaDoToken(token).id) ?? null,
  ],

  // Não recebe corpo: a campanha nasce com NivelAtual 1 e XPTotal 0, e o
  // JogadorID sai do token. Quem já tem campanha recebe a que existe, e
  // nenhuma segunda é criada — é isso que torna o botão do lobby seguro
  // contra clique duplo, aba duplicada e F5 no meio do caminho.
  [
    'POST',
    montarRegex('/solo/campanha'),
    (params, corpo, token) => {
      const jogador = contaDoToken(token);
      const existente = campanhaDoJogador(jogador.id);
      if (existente) return existente;

      const nova: Campanha = {
        campanhaId: gerarId('camp'),
        jogadorId: jogador.id,
        nivelAtual: 1,
        xpTotal: 0,
      };
      dados.campanhas.push(nova);
      dados.historicoSolo[nova.campanhaId] = [];
      return nova;
    },
  ],

  // --- solo: estatísticas da campanha do jogador logado ------------------
  // Sem id na URL, como /solo/campanha: a campanha sai do token. O que sai
  // daqui é só o que nenhuma outra rota dá — o agregado por lição (com o
  // JOIN em ExerciciosSolo para título e nível) e as melhores marcas.
  // Nível e XP ficam em GET /solo/campanha; sequência e evolução o front
  // deriva do histórico. Sem campanha é 404 (campanhaDoToken): a tela
  // redireciona para o lobby antes de chegar aqui, então isto só protege a
  // rota.
  [
    'GET',
    montarRegex('/solo/estatisticas'),
    (params, corpo, token) => {
      const campanha = campanhaDoToken(token);
      const historico = dados.historicoSolo[campanha.campanhaId] ?? [];

      // Uma linha por lição tentada. JOIN interno: sessão de lição que não
      // existe mais não entra — o back real faria o mesmo.
      const porId = new Map<string, DesempenhoLicaoSolo>();
      for (const h of historico) {
        const missao = dados.missoes.find((m) => m.exerciseId === h.exerciseId);
        if (!missao) continue;
        const linha = porId.get(h.exerciseId);
        if (!linha) {
          porId.set(h.exerciseId, {
            exerciseId: missao.exerciseId,
            titulo: missao.titulo,
            nivel: missao.nivel,
            tentativas: 1,
            melhorWpm: h.wpm,
            melhorPrecisao: h.precisao,
            ultimaVez: h.data,
          });
          continue;
        }
        linha.tentativas += 1;
        linha.melhorWpm = Math.max(linha.melhorWpm ?? 0, h.wpm);
        linha.melhorPrecisao = Math.max(linha.melhorPrecisao ?? 0, h.precisao);
        if (h.data > linha.ultimaVez) linha.ultimaVez = h.data;
      }

      const resposta: EstatisticasSolo = {
        campanhaId: campanha.campanhaId,
        // Lições distintas com ao menos uma sessão concluída.
        licoesConcluidas: new Set(historico.filter((h) => h.concluida).map((h) => h.exerciseId)).size,
        melhorWpm: historico.length ? Math.max(...historico.map((h) => h.wpm)) : null,
        melhorPrecisao: historico.length ? Math.max(...historico.map((h) => h.precisao)) : null,
        porLicao: [...porId.values()],
      };
      return resposta;
    },
  ],

  // --- solo: missões e sub-recursos da campanha -------------------------
  // Sem id na URL, como /solo/historico: a campanha é a do token. Com id,
  // qualquer conta pediria os dados de qualquer campanha.
  [
    'GET',
    montarRegex('/solo/missoes'),
    (params, corpo, token) => {
      campanhaDoToken(token);
      // Devolve TODAS as 76 lições, na ordem do percurso, e nenhuma vem
      // bloqueada: a tabela ExerciciosSolo não tem nível mínimo e a conta
      // não guarda progresso por lição — não há com o que trancar nada.
      // O nível de uma lição é AGRUPAMENTO na tela, não requisito.
      //
      // Só o `texto` sai fora: em lista ele seria ~30 KB de texto que
      // nenhum cartão mostra. Ele volta no detalhe, em /solo/missoes/:id.
      return dados.missoes.map(({ texto, ...licao }) => licao);
    },
  ],
  // Era /solo/campanhas/:id/historico. O id saiu da URL: a campanha é a
  // do token, como em /solo/campanha e /solo/estatisticas — com id na URL,
  // qualquer conta pediria o histórico de qualquer campanha.
  [
    'GET',
    montarRegex('/solo/historico'),
    (params, corpo, token) => {
      const campanha = campanhaDoToken(token);
      // Uma linha por sessão jogada: paginada.
      return paginado(dados.historicoSolo[campanha.campanhaId] ?? []);
    },
  ],
  [
    'GET',
    montarRegex('/solo/indicadores'),
    (params, corpo, token) => {
      const campanha = campanhaDoToken(token);
      const historico = dados.historicoSolo[campanha.campanhaId] ?? [];
      const concluidas = historico.filter((h) => h.concluida);
      return {
        campanhaId: campanha.campanhaId,
        nivelAtual: campanha.nivelAtual,
        xpTotal: campanha.xpTotal,
        sessoesTotais: historico.length,
        wpmMedio: media(concluidas.map((h) => h.wpm)),
        precisaoMedia: media(concluidas.map((h) => h.precisao)),
        melhorWpm: historico.length ? Math.max(...historico.map((h) => h.wpm)) : null,
      };
    },
  ],
  ['GET', montarRegex('/solo/campanhas/:id'), (params, corpo, token) => campanhaDaConta(params[0], token)],
  [
    'DELETE',
    montarRegex('/solo/campanhas/:id'),
    (params, corpo, token) => {
      const campanha = campanhaDaConta(params[0], token);
      dados.campanhas.splice(dados.campanhas.indexOf(campanha), 1);
      return null;
    },
  ],
  [
    'GET',
    montarRegex('/solo/missoes/:id'),
    (params) => {
      const missao = dados.missoes.find((m) => m.exerciseId === params[0]);
      if (!missao) throw erro(404, 'Lição não encontrada.', 'NAO_ENCONTRADO');
      // A lição já traz o texto do professor: é o único lugar que o entrega.
      return missao;
    },
  ],
  [
    'POST',
    montarRegex('/solo/sessoes'),
    (params, corpo, token) => {
      // corpo: exercicio_id (posto pela tela de treino) e o pacote do motor:
      // { wpm, precisao, acertos, erros, tempo_gasto_segundos, concluida }.
      // A campanha é a do TOKEN, como nas outras rotas do Solo: campanha_id
      // no corpo deixava gravar XP na campanha de outro jogador.
      // Os nomes camelCase antigos seguem aceitos como fallback.
      const campanha = campanhaDoToken(token);
      const exercicioId = corpo?.exercicio_id ?? corpo?.exerciseId;
      const missao = dados.missoes.find((m) => m.exerciseId === exercicioId);
      if (!missao) throw erro(404, 'Lição não encontrada.', 'NAO_ENCONTRADO');

      // O XP base é o mesmo para toda lição e vem do config, não de uma
      // coluna por exercício: ExerciciosSolo não tem XPConcessao. Antes
      // este número saía de missao.xpConcessao, que era invenção do mock.
      const base = CONFIG.SOLO.XP_BASE_MISSAO;
      const precisao = corpo?.precisao ?? 0;
      const concluida = corpo?.concluida ?? false;

      // Concluiu: base + bônus proporcional à precisão. O fator vem do
      // config (MULTIPLICADOR_BONUS_PRECISAO), não de um literal aqui —
      // senão o número existe em dois lugares e o config não manda em nada.
      // Não concluiu: só 30% do base, sem bônus.
      const xpGanho = concluida
        ? base +
          Math.round(base * (precisao / 100) * CONFIG.SOLO.MULTIPLICADOR_BONUS_PRECISAO)
        : Math.round(base * 0.3);

      const nivelAntes = campanha.nivelAtual;
      campanha.xpTotal += xpGanho;
      campanha.nivelAtual = recalcularNivel(campanha.xpTotal);
      const subiuDeNivel = campanha.nivelAtual > nivelAntes;

      const historico = (dados.historicoSolo[campanha.campanhaId] ??= []);
      const melhorAntes = Math.max(
        0,
        ...historico
          .filter((h) => h.exerciseId === missao.exerciseId)
          .map((h) => h.wpm)
      );
      const recordePessoal = (corpo?.wpm ?? 0) > melhorAntes;

      const registro: SessaoSolo = {
        id: gerarId('hs'),
        exerciseId: missao.exerciseId,
        wpm: corpo?.wpm ?? 0,
        precisao,
        tempoSegundos: corpo?.tempo_gasto_segundos ?? 0,
        acertos: corpo?.acertos ?? 0,
        erros: corpo?.erros ?? 0,
        concluida,
        xpGanho,
        data: agora(),
      };
      historico.push(registro);

      // O id vai junto: a tela de resultado é aberta com ?sessao=<id>.
      return {
        id: registro.id,
        xpGanho,
        xpTotal: campanha.xpTotal,
        nivelAtual: campanha.nivelAtual,
        subiuDeNivel,
        recordePessoal,
      };
    },
  ],

  // --- turmas ----------------------------------------------------------
  // As turmas da conta do token, filtradas por Ativa — o WHERE
  // ProfessorID = ? AND Ativa = ? do back. Sem ?ativa=, vale TRUE: a tela
  // de turmas pede as arquivadas à parte, com ?ativa=false. convitesPendentes é o COUNT que o back faz em
  // ClassMembers (Status = 'convidado'); aqui, contado em `convites`.
  [
    'GET',
    montarRegex('/turmas'),
    (params, corpo, token, query) => {
      const dono = contaDoToken(token).id;
      const querAtivas = query?.get('ativa') !== 'false';
      return dados.turmas
        .filter((t) => t.professorId === dono && t.ativa === querAtivas)
        .map((t) => ({
          ...t,
          convitesPendentes: dados.convites.filter((c) => c.turmaId === t.id).length,
        }));
    },
  ],
  [
    'POST',
    montarRegex('/turmas'),
    (params, corpo, token) => {
      const nova: Turma = {
        id: gerarId('turma'),
        professorId: contaDoToken(token).id,
        nome: corpo?.nome ?? 'Nova turma',
          totalAlunos: 0,
        totalExercicios: 0,
        ativa: true,
        dataCriacao: hoje(),
      };
      dados.turmas.push(nova);
      dados.alunos[nova.id] = [];
      dados.atribuicoes[nova.id] = [];
      // A mesma forma de um item de GET /turmas: a tela põe a resposta
      // direto na grade.
      return { ...nova, convitesPendentes: 0 };
    },
  ],
  [
    // Detalhe da turma. Traz as três métricas do topo da tela de turma já
    // calculadas: o front não soma nada. O ppmMedio sai só dos alunos que
    // treinaram — quem nunca treinou não puxa a média para baixo, ele
    // simplesmente não entra nela — e é null quando ninguém treinou.
    'GET',
    montarRegex('/turmas/:id'),
    (params, corpo, token) => {
      const turma = turmaDaConta(params[0], token);
      const lista = dados.alunos[turma.id] ?? [];
      const comSessao = lista.filter((a) => a.totalSessoes > 0);
      return {
        ...turma,
        totalAlunos: lista.length,
        totalExercicios: (dados.atribuicoes[turma.id] ?? []).length,
        ppmMedio: mediaDecimal(comSessao.map((a) => a.wpmMedio)),
      };
    },
  ],
  [
    // PATCH: só o campo enviado muda. Três usos, um campo cada: renomear
    // ({ nome }), trocar a capa ({ capaSemente }) e arquivar/desarquivar
    // ({ ativa: false | true }).
    // Os 400 daqui espelham o que o back valida: a tela já barra antes,
    // mas o mock não pode ser mais frouxo que ele.
    'PATCH',
    montarRegex('/turmas/:id'),
    (params, corpo, token) => {
      const turma = turmaDaConta(params[0], token);
      if (corpo?.nome !== undefined) {
        const nome = String(corpo.nome).trim();
        if (nome.length < 3 || nome.length > 100) {
          throw erro(400, 'Nome de turma inválido.', 'DADOS_INVALIDOS');
        }
        turma.nome = nome;
      }
      if (corpo?.capaSemente !== undefined) {
        if (!Number.isInteger(corpo.capaSemente)) {
          throw erro(400, 'Semente de capa inválida.', 'DADOS_INVALIDOS');
        }
        turma.capaSemente = corpo.capaSemente;
      }
      if (corpo?.ativa !== undefined) {
        if (typeof corpo.ativa !== 'boolean') {
          throw erro(400, 'Valor de ativa inválido.', 'DADOS_INVALIDOS');
        }
        turma.ativa = corpo.ativa;
      }
      return turma;
    },
  ],

  // --- alunos --------------------------------------------------------
  // A lista da turma: ativos e convidados juntos, cada linha com o estado.
  // Os ativos primeiro, na ordem em que entraram; depois os convidados.
  [
    'GET',
    montarRegex('/turmas/:turmaId/alunos'),
    (params, corpo, token): LinhaDaTurma[] => {
      const turma = turmaDaConta(params[0], token);
      const ativos: LinhaDaTurma[] = (dados.alunos[turma.id] ?? []).map((a) => ({ ...a, estado: 'ativo' }));
      const convidados = dados.convites.filter((c) => c.turmaId === turma.id).map(convidadoDaTurma);
      return [...ativos, ...convidados];
    },
  ],

  // --- convites pelo RP --------------------------------------------------
  // O professor não cria conta de ninguém: convida o RP de uma conta que já
  // existe. As antigas POST /turmas/:id/alunos (cadastrar), .../importar e
  // /alunos/:id/resetar-senha saíram, e com elas o PATCH /alunos/:id: o
  // nome do aluno é o da conta dele, que só ele muda.
  [
    'POST',
    montarRegex('/turmas/:turmaId/convites/importar'),
    (params, corpo, token): ResultadoConvites => {
      const turma = turmaDaConta(params[0], token);
      const meuRp = rpDaConta(contaDoToken(token).id);
      const resultado: ResultadoConvites = { convidados: [], jaEstavam: [], falhas: [] };
      const vistos = new Set<string>();
      for (const bruto of corpo?.rps ?? []) {
        const rp = normalizarRp(bruto);
        if (vistos.has(rp)) {
          resultado.falhas.push({ rp, motivo: 'RP repetido na lista' });
          continue;
        }
        vistos.add(rp);
        const estado = estadoNaTurma(turma.id, rp);
        if (estado) {
          resultado.jaEstavam.push({ rp, estado });
          continue;
        }
        try {
          resultado.convidados.push(convidarRp(turma.id, rp, meuRp));
        } catch (e) {
          resultado.falhas.push({ rp, motivo: (e as Error).message });
        }
      }
      return resultado;
    },
  ],
  [
    'POST',
    montarRegex('/turmas/:turmaId/convites'),
    (params, corpo, token): ConvidadoDaTurma => {
      const turma = turmaDaConta(params[0], token);
      const meuRp = rpDaConta(contaDoToken(token).id);
      return convidarRp(turma.id, normalizarRp(corpo?.rp), meuRp);
    },
  ],
  [
    'DELETE',
    montarRegex('/turmas/:turmaId/convites/:rp'),
    (params, corpo, token) => {
      const turma = turmaDaConta(params[0], token);
      tirarConvite(exigirConvite(turma.id, normalizarRp(params[1])));
      return null;
    },
  ],
  [
    'GET',
    montarRegex('/turmas/:turmaId/alunos/:alunoId/desempenho'),
    (params, corpo, token) => {
      const [turmaId, alunoId] = params;
      turmaDaConta(turmaId, token);
      const aluno = (dados.alunos[turmaId] ?? []).find((a) => a.id === alunoId);
      if (!aluno) throw erro(404, 'Aluno não encontrado nesta turma.', 'NAO_ENCONTRADO');
      // Só as sessões DESTA turma: as das outras turmas dele são de outros
      // professores, e este professor não tem nada com elas. Os agregados
      // saem da mesma lista, para os números baterem com as sessões.
      const sessoes = sessoesNaSala(turmaId, alunoId);
      const concluidas = sessoes.filter((s) => s.concluida);
      return {
        // A tela identifica o aluno por alunoId, que é o RP.
        alunoId,
        totalSessoes: sessoes.length,
        wpmMedio: media(concluidas.map((s) => s.wpm)), // null quando nunca concluiu
        precisaoMedia: media(concluidas.map((s) => s.precisao)),
        sessoes,
      };
    },
  ],
  [
    'DELETE',
    montarRegex('/turmas/:turmaId/alunos/:alunoId'),
    (params, corpo, token) => {
      const [turmaId, alunoId] = params;
      const turma = turmaDaConta(turmaId, token);
      const lista = dados.alunos[turmaId] ?? [];
      const i = lista.findIndex((a) => a.id === alunoId);
      if (i < 0) throw erro(404, 'Aluno não encontrado nesta turma.', 'NAO_ENCONTRADO');
      lista.splice(i, 1);
      turma.totalAlunos = lista.length;
      return null;
    },
  ],
  // --- exercícios --------------------------------------------------
  // Biblioteca do professor: cresce sem teto, então é paginada no contrato.
  // Cada item sai com o texto e com o atribuidoA contado na hora.
  [
    'GET',
    montarRegex('/exercicios'),
    (params, corpo, token) => {
      const dono = contaDoToken(token).id;
      return paginado(dados.exercicios.filter((e) => e.professorId === dono).map(comAtribuidoA));
    },
  ],
  [
    'POST',
    montarRegex('/exercicios'),
    (params, corpo, token) => {
      const novo: Exercicio = {
        id: gerarId('ex-prof'),
        professorId: contaDoToken(token).id,
        titulo: corpo?.titulo ?? 'Sem título',
        texto: corpo?.texto ?? '',
        dificuldade: corpo?.dificuldade ?? 'facil',
        tempoLimiteSegundos: corpo?.tempoLimiteSegundos ?? 0,
      };
      dados.exercicios.push(novo);
      return comAtribuidoA(novo);
    },
  ],
  [
    'GET',
    montarRegex('/exercicios/:id'),
    (params, corpo, token, query) =>
      comAtribuidoA(exercicioVisivel(params[0], token, query?.get('turma') ?? null)),
  ],
  [
    'PATCH',
    montarRegex('/exercicios/:id'),
    (params, corpo, token) => {
      const ex = exercicioDaConta(params[0], token);
      ex.titulo = corpo?.titulo ?? ex.titulo;
      ex.texto = corpo?.texto ?? ex.texto;
      ex.dificuldade = corpo?.dificuldade ?? ex.dificuldade;
      ex.tempoLimiteSegundos = corpo?.tempoLimiteSegundos ?? ex.tempoLimiteSegundos;
      return comAtribuidoA(ex);
    },
  ],
  [
    // DELETE de verdade, espelhando o ON DELETE CASCADE do banco: some da
    // biblioteca, sai de todas as turmas (AtribuicoesProf) e leva junto as
    // sessões dos alunos nele (SessionsProf). É por isso que a tela avisa
    // quantas turmas vão perder o exercício antes de confirmar.
    'DELETE',
    montarRegex('/exercicios/:id'),
    (params, corpo, token) => {
      const ex = exercicioDaConta(params[0], token);
      dados.exercicios.splice(dados.exercicios.indexOf(ex), 1);
      for (const [turmaId, lista] of Object.entries(dados.atribuicoes)) {
        const restantes = lista.filter((a) => a.exerciseId !== ex.id);
        if (restantes.length === lista.length) continue;
        dados.atribuicoes[turmaId] = restantes;
        const turma = dados.turmas.find((t) => t.id === turmaId);
        if (turma) turma.totalExercicios = restantes.length;
      }
      dados.sessoes = dados.sessoes.filter((se) => se.exerciseId !== ex.id);
      return null;
    },
  ],

  // --- atribuições (visão do professor) ----------------------------
  // Mesma tabela que /aluno/salas/:id lê, outro leitor: aqui vai a
  // contagem de quem já concluiu, que é informação da turma inteira e não
  // pode aparecer na lista que o ALUNO recebe.
  [
    'GET',
    montarRegex('/turmas/:turmaId/atribuicoes'),
    (params, corpo, token) => {
      const [turmaId] = params;
      turmaDaConta(turmaId, token);
      const totalAlunos = (dados.alunos[turmaId] ?? []).length;
      return (dados.atribuicoes[turmaId] ?? [])
        .map((a) => {
          // A exclusão de exercício já limpa as atribuições dele (cascata);
          // o teste fica só por segurança.
          const ex = dados.exercicios.find((e) => e.id === a.exerciseId);
          if (!ex) return null;
          return {
            exercicioId: ex.id,
            titulo: ex.titulo,
            dificuldade: ex.dificuldade,
            atribuidoEm: a.atribuidoEm ?? null,
            concluidoPor: concluintes(turmaId, ex.id),
            totalAlunos,
          };
        })
        .filter(Boolean);
    },
  ],
  [
    // Atribui vários de uma vez: { exercicioIds: [] }. Repetir um exercício
    // já atribuído não é erro nem duplica a linha — a chave primária é o
    // par (turma, exercício), então a segunda vez simplesmente não faz nada.
    'POST',
    montarRegex('/turmas/:turmaId/atribuicoes'),
    (params, corpo, token) => {
      const [turmaId] = params;
      const turma = turmaDaConta(turmaId, token);
      const lista = (dados.atribuicoes[turmaId] ??= []);
      const ids = corpo?.exercicioIds ?? [];

      // Id que não existe na biblioteca DESTA conta é recusado ANTES de
      // gravar qualquer um: metade atribuída é pior que nada atribuído.
      for (const exId of ids) exercicioDaConta(exId, token);

      for (const exId of ids) {
        if (!lista.some((a) => a.exerciseId === exId)) {
          lista.push({ exerciseId: exId, atribuidoEm: hoje(), prazo: null });
        }
      }
      turma.totalExercicios = lista.length;
      return lista;
    },
  ],
  [
    // Remove pelo PAR turma + exercício, porque é essa a chave primária de
    // AtribuicoesProf. Não existe /atribuicoes/:id.
    'DELETE',
    montarRegex('/turmas/:turmaId/atribuicoes/:exercicioId'),
    (params, corpo, token) => {
      const [turmaId, exercicioId] = params;
      const turma = turmaDaConta(turmaId, token);
      const lista = dados.atribuicoes[turmaId] ?? [];
      const i = lista.findIndex((a) => a.exerciseId === exercicioId);
      if (i < 0) throw erro(404, 'Atribuição não encontrada.', 'NAO_ENCONTRADO');
      lista.splice(i, 1);
      turma.totalExercicios = lista.length;
      return null;
    },
  ],

  // --- relatórios do professor -----------------------------------
  // As quatro rotas de pages/professor/relatorios.html. Tudo agregado AQUI
  // (é o back), a partir das sessões: a tela não soma nem divide nada.
  //
  // Toda média passa por media(), que devolve null sem amostra — o null que
  // a tela transforma em "—". Nenhuma delas devolve 0 no lugar de null.
  [
    // As quatro métricas do topo. Estende o tipo DesempenhoTurma (que era a
    // resposta da antiga /turmas/:id/desempenho) com mais dois campos.
    'GET',
    montarRegex('/turmas/:turmaId/relatorio'),
    (params, corpo, token): RelatorioTurma => {
      const [turmaId] = params;
      turmaDaConta(turmaId, token);
      const atribuidos = exerciciosDaTurma(turmaId).size;
      const linhas = (dados.alunos[turmaId] ?? []).map((a) =>
        linhaPorAluno(turmaId, a, atribuidos)
      );
      const comSessao = linhas.filter((l) => l.totalSessoes > 0);

      // Filtra o null ANTES de somar: um null viraria 0 na soma e puxaria a
      // média da turma para baixo — o aluno que só tem sessão inacabada
      // simplesmente não entra na média, como quem nunca treinou.
      const ppms = comSessao.map((l) => l.wpmMedio).filter((n) => n != null);
      const precisoes = comSessao.map((l) => l.precisaoMedia).filter((n) => n != null);

      return {
        turmaId,
        totalAlunos: linhas.length,
        alunosComSessao: comSessao.length,
        // O numerador de "8 de 12". A janela (DIAS_ATIVO) é decisão do
        // back: a tela recebe o número já contado.
        alunosAtivos: linhas.filter((l) =>
          treinouNosUltimosDias(l.ultimaAtividade, DIAS_ATIVO)
        ).length,
        wpmMedio: media(ppms),
        precisaoMedia: media(precisoes),
        // COUNT, não média: zero aqui é zero mesmo — a turma tem exercício
        // atribuído e ninguém terminou nenhum.
        exerciciosConcluidos: linhas.reduce((total, l) => total + l.exerciciosConcluidos, 0),
      };
    },
  ],
  [
    // Uma linha por aluno ATIVO (só `alunos`: convidado não entra), inclusive quem nunca treinou (ele
    // vem com totalSessoes 0 e as médias em null). Lista curta, array puro.
    'GET',
    montarRegex('/turmas/:turmaId/relatorio/alunos'),
    (params, corpo, token): RelatorioAluno[] => {
      const [turmaId] = params;
      turmaDaConta(turmaId, token);
      const atribuidos = exerciciosDaTurma(turmaId).size;
      return (dados.alunos[turmaId] ?? []).map((a) => linhaPorAluno(turmaId, a, atribuidos));
    },
  ],
  [
    // Uma linha por exercício ATRIBUÍDO à turma — nada de listar a
    // biblioteca inteira. Turma sem atribuição devolve [].
    'GET',
    montarRegex('/turmas/:turmaId/relatorio/exercicios'),
    (params, corpo, token): RelatorioExercicio[] => {
      const [turmaId] = params;
      turmaDaConta(turmaId, token);
      const matriculas = matriculasDaTurma(turmaId);
      const totalAlunos = matriculas.size;
      return (dados.atribuicoes[turmaId] ?? [])
        .map((a) => linhaPorExercicio(turmaId, a, totalAlunos, matriculas))
        .filter(Boolean);
    },
  ],
  [
    // O histórico do modal: as sessões do aluno NESTA turma, já ordenadas
    // da mais recente para a mais antiga (a ordem é parte do contrato — a
    // tela não reordena por gosto, só confere). Paginada, porque um aluno
    // acumula tentativa em cima de tentativa ao longo do semestre.
    //
    // Fica depois das rotas de /alunos sem risco de ser sombreada: o
    // ([^/]+) do montarRegex não atravessa barra, então nem
    // /turmas/:id/alunos nem /turmas/:id casam com este caminho.
    'GET',
    montarRegex('/turmas/:turmaId/alunos/:matricula/sessoes'),
    (params, corpo, token): Paginado<SessaoDoAluno> => {
      const [turmaId, matricula] = params;
      turmaDaConta(turmaId, token);
      // Aluno que não é desta turma é 404, e não lista vazia: lista vazia
      // significaria "está na turma e nunca treinou", que é outra coisa.
      if (!matriculasDaTurma(turmaId).has(matricula)) {
        throw erro(404, 'Aluno não encontrado nesta turma.', 'NAO_ENCONTRADO');
      }
      const itens = sessoesDoAlunoNaTurma(turmaId, matricula)
        .map((s) => ({
          ...s,
          // O JOIN com ExerciciosProf. null se o exercício foi excluído.
          tituloExercicio: dados.exercicios.find((e) => e.id === s.exerciseId)?.titulo ?? null,
        }))
        // ISO ordena como texto; b antes de a = mais recente primeiro.
        .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
      return paginado(itens);
    },
  ],

  // --- o próprio aluno logado ------------------------------------
  // As duas rotas de pages/aluno/historico.html. Nenhuma das duas recebe
  // matrícula: o aluno sai do TOKEN (alunoDoToken). Não há como pedir o
  // histórico de outra pessoa editando a URL — não existe parâmetro para
  // isso, que é a única forma segura de não existir o caminho.
  [
    'GET',
    montarRegex('/aluno/historico'),
    (params, corpo, token): Paginado<SessaoDoHistorico> => {
      const aluno = alunoDoToken(token);
      return paginado(historicoDoAluno(aluno.id));
    },
  ],
  [
    'GET',
    montarRegex('/aluno/resumo'),
    (params, corpo, token): ResumoDoAluno => {
      const aluno = alunoDoToken(token);
      const minhas = dados.sessoes.filter((s) => s.alunoId === aluno.id);
      const concluidas = minhas.filter((s) => s.concluida);
      return {
        sessoesTotais: minhas.length,
        // Uma sessão concluída é um exercício feito. COUNT, não média:
        // zero aqui é zero mesmo.
        sessoesConcluidas: concluidas.length,
        // Médias só sobre o que ele terminou, e null sem amostra — nunca 0.
        // São as médias DELE; não existe média de turma nesta resposta.
        wpmMedio: media(concluidas.map((s) => s.wpm)),
        precisaoMedia: media(concluidas.map((s) => s.precisao)),
        // As melhores marcas saem de TODAS as sessões, inclusive a que
        // estourou o tempo: o PPM que ele fez naquele minuto foi dele.
        melhorWpm: minhas.length ? Math.max(...minhas.map((s) => s.wpm)) : null,
        melhorPrecisao: minhas.length ? Math.max(...minhas.map((s) => s.precisao)) : null,
        diasSeguidos: sequenciaDeDias(minhas),
      };
    },
  ],

  // As salas do aluno. Como as de cima, saem do token: o :id é da sala,
  // e sala em que ele não está é 404.
  [
    'GET',
    montarRegex('/aluno/salas'),
    (params, corpo, token): SalaDoAluno[] => {
      const aluno = alunoDoToken(token);
      return salasDoAluno(aluno.id).map((turma) => resumoDaSala(turma, aluno.id));
    },
  ],
  [
    'GET',
    montarRegex('/aluno/salas/:id'),
    (params, corpo, token): SalaDetalhe => {
      const aluno = alunoDoToken(token);
      const turma = salasDoAluno(aluno.id).find((t) => t.id === params[0]);
      if (!turma) throw erro(404, 'Sala não encontrada.', 'NAO_ENCONTRADO');
      return { ...resumoDaSala(turma, aluno.id), lista: exerciciosDaSala(turma.id, aluno.id) };
    },
  ],

  // O relatório individual do aluno na sala. Abaixo do mínimo de sessões
  // concluídas, as duas médias vêm null: a tela mostra quanto falta.
  [
    'GET',
    montarRegex('/turmas/:id/meu-desempenho'),
    (params, corpo, token): DesempenhoNaTurma => {
      const { turma, aluno } = salaDoToken(params[0], token);
      const meus = numerosNaSala(turma.id, aluno.id);
      const resposta: DesempenhoNaTurma = {
        sessoesConcluidas: meus.concluidas.length,
        licoes: meus.licoes,
        diasSeguidos: meus.diasSeguidos,
        minhaMedia: null,
        mediaSala: null,
      };
      if (meus.concluidas.length < MINIMO_DE_SESSOES) return resposta;

      // A média da sala é sobre as sessões concluídas de TODOS os alunos
      // ativos dela, ele incluído.
      const daSala = (dados.alunos[turma.id] ?? []).flatMap(
        (membro) => numerosNaSala(turma.id, membro.id).concluidas
      );
      resposta.minhaMedia = {
        velocidade: media(meus.concluidas.map((s) => s.wpm)),
        precisao: media(meus.concluidas.map((s) => s.precisao)),
      };
      resposta.mediaSala = {
        velocidade: media(daSala.map((s) => s.wpm)),
        precisao: media(daSala.map((s) => s.precisao)),
      };
      return resposta;
    },
  ],

  // O ranking da sala, visto pelo aluno. A ANONIMIZAÇÃO É AQUI: do quarto
  // lugar em diante o nome não sai do servidor, menos o dele próprio. Se a
  // tela é que escondesse, o nome de todo mundo estaria na resposta, à
  // vista de qualquer um que abrisse o DevTools.
  [
    'GET',
    montarRegex('/turmas/:id/ranking'),
    (params, corpo, token): LinhaDoRanking[] => {
      const { turma, aluno } = salaDoToken(params[0], token);
      return rankingDaTurma(turma.id).map((linha, i) => {
        const voce = linha.alunoId === aluno.id;
        const noPodio = i < 3;
        const membro = (dados.alunos[turma.id] ?? []).find((a) => a.id === linha.alunoId);
        // Sem nome no cadastro, o RP: nunca um nome inventado.
        const nome = membro?.nome ?? nomeDoRp(linha.alunoId) ?? linha.alunoId;
        return {
          posicao: i + 1,
          nome: voce || noPodio ? nome : null,
          voce,
          licoes: linha.licoes,
          ritmo: linha.ritmo,
          diasSeguidos: linha.diasSeguidos,
          pontos: linha.pontos,
        };
      });
    },
  ],

  // Os convites do aluno. Também saem do token: o :turmaId é da sala, e
  // só vale o convite que é DELE.
  [
    'GET',
    montarRegex('/aluno/convites'),
    (params, corpo, token): ConviteDoAluno[] => {
      const aluno = alunoDoToken(token);
      const lista: ConviteDoAluno[] = [];
      for (const convite of dados.convites.filter((c) => c.alunoId === aluno.id)) {
        const turma = dados.turmas.find((t) => t.id === convite.turmaId && t.ativa);
        if (!turma) continue;
        lista.push({
          turmaId: turma.id,
          nome: turma.nome,
          professor: nomeDoProfessor(turma.professorId),
          totalAlunos: (dados.alunos[turma.id] ?? []).length,
          totalExercicios: (dados.atribuicoes[turma.id] ?? []).length,
          convidadoEm: convite.convidadoEm,
        });
      }
      // O mais recente primeiro. ISO ordena como texto.
      return lista.sort((a, b) => String(b.convidadoEm).localeCompare(String(a.convidadoEm)));
    },
  ],
  [
    'POST',
    montarRegex('/aluno/convites/:turmaId/aceitar'),
    (params, corpo, token): SalaDoAluno => {
      const aluno = alunoDoToken(token);
      const convite = exigirConvite(params[0], aluno.id);
      const turma = dados.turmas.find((t) => t.id === convite.turmaId);
      if (!turma) throw erro(404, 'Convite não encontrado.', 'NAO_ENCONTRADO');
      tirarConvite(convite);
      // Status 'convidado' -> 'ativo': agora ele está na sala.
      // No banco: Status = 'ativo' (coluna da v6, ainda não criada) e
      // Data_Matricula = agora (coluna que já existe; na v6 ela passa a
      // ser a data do aceite — ver o topo de api.ts). O entrouEm de
      // novoAluno() é essa data.
      (dados.alunos[turma.id] ??= []).push({ ...novoAluno(aluno.id), nome: aluno.nome ?? null });
      turma.totalAlunos = dados.alunos[turma.id].length;
      return resumoDaSala(turma, aluno.id);
    },
  ],
  [
    'POST',
    montarRegex('/aluno/convites/:turmaId/recusar'),
    (params, corpo, token) => {
      const aluno = alunoDoToken(token);
      // No banco: Status = 'recusado' (coluna da v6, ainda não criada). A
      // linha fica, e só o professor pode convidar de novo.
      tirarConvite(exigirConvite(params[0], aluno.id));
      return null;
    },
  ],

  // --- sessões (mundo Escola) ------------------------------------
  [
    'POST',
    montarRegex('/sessoes'),
    (params, corpo, token) => {
      // corpo: exercicio_id + turma_id (postos pela tela de treino) e o pacote
      // do motor: { wpm, precisao, acertos, erros, tempo_gasto_segundos,
      // concluida }. O aluno vem do TOKEN, nunca do corpo: token de conta é
      // 403 (sessão do Solo é POST /solo/sessoes, e a prévia do professor
      // não grava). Exercício não atribuído à turma, ou turma em que o
      // aluno não está: 404 — senão a sessão nasce fora de qualquer turma
      // e aparece no relatório de um exercício que o professor nunca deu.
      // Os nomes camelCase antigos seguem aceitos como fallback.
      const alunoId = alunoDoToken(token).id;
      const turmaId: string | null = corpo?.turma_id ?? corpo?.turmaId ?? null;
      const exerciseId = exercicioAtribuidoAoAluno(
        corpo?.exercicio_id ?? corpo?.exerciseId ?? '',
        alunoId,
        turmaId
      ).id;
      const anteriores = dados.sessoes.filter(
        (s) => s.alunoId === alunoId && s.exerciseId === exerciseId
      );
      const melhorAntes = Math.max(0, ...anteriores.map((s) => s.wpm));

      const nova: Sessao = {
        id: gerarId('ses'),
        exerciseId,
        alunoId,
        turmaId,
        wpm: corpo?.wpm ?? 0,
        precisao: corpo?.precisao ?? 0,
        tempoSegundos: corpo?.tempo_gasto_segundos ?? 0,
        acertos: corpo?.acertos ?? 0,
        erros: corpo?.erros ?? 0,
        concluida: corpo?.concluida ?? false,
        data: agora(),
      };
      dados.sessoes.push(nova);

      // Reflete na hora nas médias do aluno, para o GET desempenho bater.
      for (const lista of Object.values(dados.alunos)) {
        const aluno = lista.find((a) => a.id === nova.alunoId);
        if (!aluno) continue;
        const concluidas = dados.sessoes.filter((s) => s.alunoId === aluno.id && s.concluida);
        aluno.totalSessoes = dados.sessoes.filter((s) => s.alunoId === aluno.id).length;
        aluno.wpmMedio = media(concluidas.map((s) => s.wpm));
        aluno.precisaoMedia = media(concluidas.map((s) => s.precisao));
      }

      return { ...nova, recordePessoal: nova.wpm > melhorAntes };
    },
  ],
  // GET /sessoes e GET /sessoes/indicadores saíram daqui: eram a lista e o
  // resumo do aluno, e /aluno/historico e /aluno/resumo já os fazem melhor
  // — escopados pelo token, com o JOIN do título e da turma. As duas
  // antigas nem filtravam por aluno: devolviam as sessões e as médias de
  // TODO MUNDO a qualquer um logado.
  [
    'GET',
    montarRegex('/sessoes/:id'),
    (params, corpo, token) => sessaoDoToken(params[0], token),
  ],

  // --- admin ----------------------------------------------------
  ['GET', montarRegex('/categorias'), () => dados.categorias.filter((c) => c.ativo)],
  [
    'POST',
    montarRegex('/categorias'),
    (params, corpo, token) => {
      exigirAdministrador(token);
      const nome = corpo?.nome?.trim();
      if (!nome) throw erro(400, 'Nome é obrigatório.', 'DADOS_INVALIDOS');
      if (dados.categorias.some((c) => c.ativo && c.nome.toLowerCase() === nome.toLowerCase())) {
        throw erro(409, 'Já existe uma categoria com esse nome.', 'CATEGORIA_DUPLICADA');
      }
      const nova = { id: gerarId('cat'), nome, ativo: true };
      dados.categorias.push(nova);
      return nova;
    },
  ],
  [
    'PATCH',
    montarRegex('/categorias/:id'),
    (params, corpo, token) => {
      exigirAdministrador(token);
      const cat = dados.categorias.find((c) => String(c.id) === params[0]);
      if (!cat) throw erro(404, 'Categoria não encontrada.', 'NAO_ENCONTRADO');
      cat.nome = corpo?.nome?.trim() ?? cat.nome;
      return cat;
    },
  ],
  [
    'DELETE',
    montarRegex('/categorias/:id'),
    (params, corpo, token) => {
      exigirAdministrador(token);
      const cat = dados.categorias.find((c) => String(c.id) === params[0]);
      if (!cat) throw erro(404, 'Categoria não encontrada.', 'NAO_ENCONTRADO');
      // 409 se ainda houver exercício nessa categoria. (Os do professor não
      // têm categoria — não há tabela para isso no banco —, então só um
      // exercício com o campo legado preenchido segura a exclusão.)
      if (dados.exercicios.some((e) => e.categoria === cat.nome)) {
        throw erro(409, 'Categoria em uso por um exercício ativo.', 'CATEGORIA_EM_USO');
      }
      cat.ativo = false; // exclusão LÓGICA
      return null;
    },
  ],
  ['GET', montarRegex('/parametros'), () => dados.parametros],
  [
    'PUT',
    montarRegex('/parametros'),
    (params, corpo, token) => {
      exigirAdministrador(token);
      Object.assign(dados.parametros, corpo ?? {});
      return dados.parametros;
    },
  ],
];

// ============================================================================
// 7. responderMock
// ============================================================================

// Rotas que não exigem token: são justamente as que o entregam (ou o
// descartam). 401 nelas quer dizer "credencial errada", não "sessão morta".
const ROTAS_PUBLICAS = ['/auth/login', '/auth/cadastro', '/auth/logout'];

// O mock não valida assinatura nenhuma — só confere se o token tem a cara
// dos que ele mesmo emite. Serve para uma coisa: dá para testar a sessão
// expirada à mão. Troque o valor de 'teclar:token' no sessionStorage por
// qualquer besteira, recarregue uma tela interna e o app deve devolver
// você para o login com o aviso "Sua sessão expirou".
function tokenValido(token: unknown): boolean {
  return typeof token === 'string' && token.startsWith('mock-');
}

// Devolve Promise<any>: a forma da resposta é escolhida pela rota em tempo
// de execução, como o resposta.json() do api.ts. Quem promete o formato de
// cada rota é o objeto `api`, não este despachante.
export async function responderMock(
  metodo: string,
  caminhoComQuery: string,
  corpo: unknown,
  token: string | null
): Promise<any> {
  await esperar(CONFIG.ATRASO_MOCK);

  const [caminho, queryString = ''] = caminhoComQuery.split('?');
  const query = new URLSearchParams(queryString);

  if (!ROTAS_PUBLICAS.includes(caminho) && !tokenValido(token)) {
    throw erro(401, 'Token inválido ou expirado.', 'TOKEN_INVALIDO');
  }
  for (const [metodoRota, regex, handler] of rotas) {
    if (metodoRota !== metodo) continue;
    const match = caminho.match(regex);
    if (match) return handler(match.slice(1), corpo, token, query);
  }

  // Nenhuma rota casou: fica óbvio qual falta implementar aqui.
  throw erro(404, `Mock ausente: ${metodo} ${caminho}`, 'MOCK_AUSENTE');
}
