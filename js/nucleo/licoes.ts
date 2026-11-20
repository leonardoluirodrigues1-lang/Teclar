// As 76 lições do Solo, numa fonte só para o front e o back.
//
// Saiu do mocks.ts porque o seed do back (back/prisma/seed.ts) grava
// estas mesmas lições na tabela ExerciciosSolo. Com duas cópias, o mock e
// o banco iam contar histórias diferentes na primeira lição corrigida.
// Por isso este arquivo não importa nada de valor do front (só tipos):
// o seed roda no Node, fora do navegador.

import type { Dificuldade, MissaoDetalhe } from './tipos.js';

// 1b. LICOES — as 76 lições do Solo
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
// O tempo (tempo_maximo_segundos) é o TOTAL da lição, de todas as
// repetições: caracteres × repetições × 12 / PPM alvo. A tela de treino dá
// a cada volta a sua parte (tempo ÷ repetições). O PPM alvo do CSV sobe com
// o nível (15 no nível 1, ~50 no 8); nos níveis 9 e 10 ele passava de 70 e
// foi limitado a 50, com o tempo recalculado por essa mesma conta.
//
// Tupla, e não objeto: são as cinco colunas que o professor preencheu, e
// só elas. Título, dificuldade e tamanho são DERIVADOS logo abaixo, pela
// mesma regra usada na carga do banco — escrever os 76 títulos à mão aqui
// seria 76 oportunidades de divergir do que está gravado lá.
export type LinhaLicao = [
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
export function montarLicao([ordem, nivel, repeticoes, tempoLimiteSegundos, texto]: LinhaLicao): MissaoDetalhe {
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
export const LICOES: LinhaLicao[] = [
  [1, 1, 3, 144, 'asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg'],
  [2, 1, 3, 144, 'asdf jklç asdf jklç asdf jklç asdf jklç asdf jklç asdf jklç'],
  [3, 1, 3, 144, 'hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç hjklç'],
  [4, 1, 3, 144, 'asdfg hjklç asdfg hjklç asdfg hjklç asdfg hjklç asdfg hjklç'],
  [5, 1, 3, 144, 'ffff jjjj dddd kkkk ssss llll aaaa çççç ffff jjjj dddd kkkk'],
  [6, 1, 3, 141, 'fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjdkslaç fjds'],
  [7, 1, 3, 144, 'dad fad jak lad sad gal sag dal gas jab lab lad sal fad bad'],
  [8, 1, 3, 150, 'ala ala lala dada saga gaga jaca jala fala sala gala bala mala'],
  [9, 2, 3, 108, 'asdf ,;;, jklç asdf ,;;, jklç asdf ,;;, jklç asdf ,;;, jklç'],
  [10, 2, 3, 108, 'zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm, zxcv bnm,'],
  [11, 2, 3, 108, 'qwer tyui qwer tyui qwer tyui poiu trew qwer tyui qwer tyui'],
  [12, 2, 3, 108, 'qaz wsx edc rfv tgb yhn ujm ik, ol. pç/ qaz wsx edc rfv tgb'],
  [13, 2, 3, 108, 'qwe rty uio pas dfg hjkl zxc vbn m,./ qwe rty uio pas dfg hjk'],
  [14, 2, 3, 108, 'zaq xsw cde vfr bgt nhy mju k,i l.o ç/p zaq xsw cde vfr bgt'],
  [15, 3, 3, 87, 'aq sw de fr gt hy ju ki lo pç aq sw de fr gt hy ju ki lo pç'],
  [16, 3, 3, 87, 'casa pato bola gato rato vela mala pipa saco luva mesa sofa'],
  [17, 3, 3, 87, 'fala gata saca jaca data sela mola neta cova lona sola ralo'],
  [18, 3, 3, 87, 'pino fino sino lino tino dino mina rina tina bina luto boto'],
  [19, 3, 3, 87, 'foco loco poco roco toco boco soco noco mudo tudo judo rudo'],
  [20, 4, 3, 75, 'AsDf GtHy JuKi LoPç QwEr TyUi ZxCv BnM, AsDf GhJk LçQw ErTy'],
  [21, 4, 3, 75, 'A Casa Branca tem Janela Azul e Porta Verde no Segundo Andar'],
  [22, 4, 3, 72, 'a veloz raposa marrom pula sobre o cao preguicoso da granja.'],
  [23, 4, 3, 69, 'O Rapido Cão de Caça Salta Acima da Velha Raposa Cansada.'],
  [24, 4, 3, 72, 'Maria foi ao mercado comprar Pão, Leite, Café e Frutas Frescas.'],
  [25, 4, 3, 72, 'Quem Venceu a Corrida de Ontem? O Atleta da Equipe Vermelha!'],
  [26, 5, 3, 63, '1234 5678 9012 3456 7890 1234 5678 9012 3456 7890 1234 5678'],
  [27, 5, 3, 63, '1a2s 3d4f 5g6h 7j8k 9l0ç 1a2s 3d4f 5g6h 7j8k 9l0ç 1a2s 3d4f'],
  [28, 5, 3, 63, '!@#$ %¨&* ()_+ !@#$ %¨&* ()_+ !@#$ %¨&* ()_+ !@#$ %¨&* ()_+'],
  [29, 5, 3, 60, 'Preco: R$ 150,00 (desconto de 10% para pagamento a vista).'],
  [30, 5, 3, 60, 'A aquisicao de velocidade depende da constancia absoluta.'],
  [31, 5, 3, 69, 'qazwsxedcrfvtgbyhnujmikolpç asdfjklç qazwsxedcrfvtgbyhnujmikolpç'],
  [32, 5, 3, 63, 'Produto SKU-9841: Estoque de 500 unidades, valor unit. $45.50.'],
  [33, 6, 3, 57, '13579 24680 13579 24680 13579 24680 13579 24680 13579 24680 13579'],
  [34, 6, 3, 57, 'a1b2 c3d4 e5f6 g7h8 i9j0 k1l2 m3n4 o5p6 q7r8 s9t0 u1v2 w3x4 y5z6'],
  [35, 6, 3, 57, '"\'~^ ´`çÇ ªº §¢£³²¹ ?/°ºª "\'~^ ´`çÇ ªº §¢£³²¹ ?/°ºª "\'~^ ´`çÇ'],
  [36, 6, 3, 57, '[{} ]+* -_=/ ?><:; "\'~^ |\\ ~]}[ {=+* -_=/ ?><:; "\'~^ |\\ ~]}['],
  [37, 6, 3, 57, '24680 97531 86420 75319 48260 15937 36925 80417 24680 97531'],
  [38, 6, 3, 57, '{[a+b] = c*d / (e-f)}; [x_1 + x_2] >= 100 && y <= 50 || z == 0;'],
  [39, 7, 3, 54, 'A prática constante e diária leva à perfeição na digitação por toque.'],
  [40, 7, 3, 60, 'O desenvolvimento de software exige precisão ao digitar códigos e variáveis.'],
  [41, 7, 3, 66, 'Exemplo de e-mail: usuario_teste.2026@empresa-br.com.br (código #4092).'],
  [42, 7, 3, 36, 'Acesse https://sistema-exemplo.gov.br'],
  [43, 7, 3, 78, 'Relatório Financeiro Q3: Lucro líquido de R$ 1.240.500,75 (crescimento de 14.2%).'],
  [44, 8, 3, 51, 'The quick brown fox jumps over the lazy dog. 0123456789 !@#$%^&*()_+'],
  [45, 8, 3, 48, 'Investimento total: R$ 8.450,90 com taxa de juros de 2,5% ao mês.'],
  [46, 8, 3, 63, 'Paralelepípedo, constituição, beneficência, idiosyncratic, anticonstitucionalissimamente.'],
  [47, 8, 3, 54, 'Zé Ramalho jogou xadrez com blitz de 5 minutos sob forte chuva no gramado.'],
  [48, 8, 3, 54, 'Gazeta publica hoje que quinze bruxas trouxeram dezquilos de feijão quebrado.'],
  [49, 1, 3, 144, 'ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl ghjkl'],
  [50, 1, 3, 132, 'asdf fds a s d f jkl lkj j k l ç a s d f j k l ç'],
  [51, 2, 3, 90, 'poiuytrewq poiuytrewq poiuytrewq poiuytrewq poiuytrewq'],
  [52, 2, 3, 102, 'mnbvcxz lkjhgfdsap mnbvcxz lkjhgfdsap mnbvcxz lkjhgfdsap'],
  [53, 3, 3, 81, 'livro papel caneta lapis borracha pasta bloco pasta regua'],
  [54, 3, 3, 84, 'chuva vento terra pedra folha galho grama flor fruta verde'],
  [55, 4, 3, 78, 'O Rato Roeu a Roupa do Rei de Roma em uma Noite Fria de Inverno.'],
  [56, 4, 3, 75, 'Por favor, envie o documento assinado ate as dezesseis horas.'],
  [57, 5, 3, 63, '9876 5432 1098 7654 3210 9876 5432 1098 7654 3210 9876 5432'],
  [58, 5, 3, 63, 'Conta #4829-1: Saldo atual de R$ 4.250,00 (Extrato Bancario).'],
  [59, 6, 3, 54, 'const express = require(\'express\'); const app = express();'],
  [60, 6, 3, 60, '<div class="container"><p id="text-main">Carregando...</p></div>'],
  [61, 7, 3, 69, 'Notificacao de sistema: Conexao segura estabelecida em wss://api.servidor.net:8443.'],
  [62, 7, 3, 54, 'Favor confirmar o agendamento da reuniao via protocolo ID#99382-X.'],
  [63, 8, 3, 60, 'Todo mundo deseja aprender novas habilidades para prosperar na era digital moderna.'],
  [64, 8, 3, 63, 'Linux, Python, JavaScript, TypeScript, PostgreSQL e Docker sao ferramentas essenciais.'],
  [65, 9, 3, 111, 'A digitação rápida é útil, mas a precisão é o que realmente importa no dia a dia profissional. Quem digita sem olhar para o teclado ganha tempo precioso.'],
  [66, 9, 3, 120, 'Ao estruturar um e-mail corporativo, lembre-se de usar cumprimentos formais adequados. A clareza na comunicação escrita evita mal-entendidos e retrabalho em equipe.'],
  [67, 9, 3, 126, 'Os atalhos de teclado e a memorização das teclas de símbolos aceleram tarefas cotidianas. Praticar alguns minutos todos os dias gera resultados surpreendentes a médio prazo.'],
  [68, 9, 3, 123, 'A tecnologia avança rápido e exige constante adaptação dos profissionais. Estar preparado significa dominar ferramentas digitais básicas com total naturalidade e fluidez.'],
  [69, 9, 3, 129, 'O sucesso de um projeto depende do alinhamento entre planejamento estratégico e execução técnica. Documentar cada etapa garante transparência e rastreabilidade para os gestores.'],
  [70, 9, 3, 123, 'Manter a postura correta e os pulsos elevados previne lesões por esforço repetitivo. A ergonomia é tão importante quanto a velocidade durante longas jornadas de trabalho.'],
  [71, 10, 2, 188, 'A prática da digitação por toque é uma habilidade transformadora na era digital. Quando os dedos encontram as teclas de forma automática e inconsciente, a mente humana se liberta por completo para focar inteiramente na criatividade, na lógica e na profundidade do conteúdo que está sendo produzido, eliminando de vez qualquer barreira física entre o pensamento veloz e a tela do computador.'],
  [72, 10, 2, 203, 'No ecossistema de desenvolvimento de software moderno, a colaboração ágil entre equipes multidisciplinares é o motor da inovação. Desenvolvedores, designers e analistas de produto compartilham repositórios de código, revisam pull requests e automatizam rotinas de entrega contínua, garantindo que novas funcionalidades cheguem aos usuários com estabilidade, segurança e alta performance operacional em servidores de nuvem.'],
  [73, 10, 2, 192, 'O planejamento financeiro pessoal requer disciplina rigorosa, acompanhamento constante de despesas e visão de longo prazo. Investir uma porcentagem fixa da renda mensal em ativos diversificados protege o patrimônio contra a inflação e abre caminhos sólidos para a independência financeira, permitindo escolhas de vida mais livres, conscientes e alinhadas aos seus verdadeiros propósitos individuais.'],
  [74, 10, 2, 185, 'A leitura atenta de livros clássicos e artigos científicos expande o vocabulário ativo e estimula o pensamento crítico. Transportar essa riqueza de termos, pontuações complexas, travessões, aspas e conjunções para os seus treinos diários de digitação prepara suas mãos para redigir teses acadêmicas, contratos jurídicos complexos ou relatórios executivos de alto impacto sem hesitação.'],
  [75, 10, 2, 201, 'A inteligência artificial generativa e os modelos de linguagem avançados estão redefinindo a maneira como interagimos com as máquinas e processamos grandes volumes de dados textuais. Embora a automação ganhe espaço, a capacidade humana de redigir com clareza, empatia, precisão gramatical e intenção estratégica permanece como um diferencial competitivo insubstituível no mercado de trabalho globalizado contemporâneo.'],
  [76, 10, 2, 199, 'Em uma manhã fria de outono, o velho relojoeiro ajustava as engrenagens minúsculas de um cronômetro suíço com pinças de precisão cirúrgica. Cada rotação sutil exigia pulso firme e paciência infinita, virtudes que ele considerava idênticas às necessárias para dominar a arte da escrita digital por toque: um delicado equilíbrio milimétrico entre o ritmo constante, a leveza do toque e a ausência absoluta de erros.'],
];
