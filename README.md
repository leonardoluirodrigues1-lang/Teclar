# TECLAR

## O que é

O TECLAR é uma plataforma web de treino de digitação, feita como trabalho do
Projeto Integrador do IFSP. A pessoa digita um texto na tela e o sistema mede
a velocidade (PPM, palavras por minuto) e a precisão, caractere por
caractere.

O sistema tem dois mundos. No **Solo**, a pessoa treina sozinha num formato
de jogo: uma campanha com níveis, missões e XP. Na **Escola**, o professor
cria turmas, cadastra os alunos e atribui exercícios; o aluno entra, treina
os exercícios da turma e o professor acompanha os relatórios. Os dois mundos
usam a mesma tela de treino e o mesmo motor de digitação
(`js/treino/typingEngine.ts`). O que muda é de onde vem o texto (uma missão
do Solo ou um exercício da turma) e para onde vai o resultado (a campanha do
Solo ou o relatório do professor).

## Como rodar

Precisa do [Node.js](https://nodejs.org) (que já traz o `npm`) e do VS Code
com a extensão **Live Server**.

1. Abra um terminal dentro da pasta `teclar` e instale as dependências:

   ```
   npm install
   ```

2. Ligue o compilador e **deixe esse terminal aberto**:

   ```
   npm run dev
   ```

   Ele converte cada `.ts`/`.tsx` em `.js` e refaz a conversão toda vez que
   um arquivo é salvo. Sem ele os `.js` não existem e nenhuma tela carrega.

3. Abra a pasta `teclar` no VS Code (a pasta `teclar`, não a pasta acima
   dela) e clique em **Go Live** na barra de baixo. O site abre no navegador
   pelo Live Server.

   É importante que a raiz do servidor seja `teclar`: as telas usam caminhos
   como `/pages/login.html`, que só funcionam a partir dela.

**Não abra o `index.html` com duplo clique.** O código é carregado como
módulo ES (o `import`/`export` do JavaScript moderno), e o navegador só
carrega módulos servidos por um servidor, nunca direto do disco.

### Contas de teste

Estão no cabeçalho de `js/nucleo/mocks.ts`:

| Tipo  | Login             | Senha      | O que tem                                              |
|-------|-------------------|------------|--------------------------------------------------------|
| Conta | `prof@teclar.dev` | `senha123` | Professor com 4 turmas e 6 exercícios. Solo recém-começado (nível 1). |
| Conta | `leo@teclar.dev`  | `senha123` | Professor com 1 turma e 1 exercício. Solo no nível 4.  |
| Conta | `ana@teclar.dev`  | `senha123` | Nenhuma turma, nenhum exercício, sem campanha (telas vazias). |
| Aluno | `RP2025043`       | `Aluno#2025` | Entrada de aluno da ana: duas salas (uma com exercício pendente, outra em dia) e dois convites. |
| Aluno | `RP2025001`       | `Aluno#2025` | Entrada de aluno do leo: sem sala e sem convite (telas vazias). |
| Aluno | `RP2025002`       | `Aluno#2025` | Entrada de aluno do prof: em sala nenhuma.             |

Toda conta tem uma entrada de aluno: um RP e uma senha de aluno, gerados no
cadastro. O RP aparece em Configurações do Solo, onde também se gera uma
senha de aluno nova.

Qualquer outra credencial é recusada. Os dados ficam só na memória e voltam
ao estado inicial a cada F5.

### Dados falsos: `CONFIG.MOCK`

Em `js/config.ts`, `CONFIG.MOCK` está `true`. Com isso o front inteiro roda
com dados falsos (os de `js/nucleo/mocks.ts`) e nenhuma requisição sai para
a rede: não é preciso ter o back rodando. Quando o back estiver pronto,
`MOCK` vira `false` e as chamadas passam a ir para `CONFIG.BASE_URL`
(`http://localhost:3000/api`).

## Mapa das pastas

Tudo abaixo está dentro de `teclar/`.

| Pasta | O que mora lá | Quando mexer |
|-------|---------------|--------------|
| `css/` | Um arquivo por área: `landing`, `auth`, `dashboard`, `solo`, `escola`, `aluno`, `treino`, `resultado`. | Para mudar o visual de uma tela específica. |
| `css/base/` | O que vale para o site todo: `tokens.css` (cores, espaçamentos, fontes em variáveis), `reset.css`, `layout.css`, `fontes.css`. | Para mudar uma cor, fonte ou medida em todo lugar de uma vez. |
| `css/componentes/` | Estilo das peças reutilizadas: botões, cards, abas, tabelas, modais, toasts, sidebar, vidro. | Para mudar uma peça que aparece em várias telas. |
| `js/nucleo/` | O coração: `api` (conversa com o back), `sessao` (quem está logado), `guarda` (quem pode abrir cada tela), `mocks` (back falso), `tipos` (formato dos dados). | Ao mudar o contrato com o back ou a regra de login. Todo o resto depende daqui. |
| `js/componentes/` | Peças de tela reutilizadas: navegação, modal, tabela, barra de XP, esqueleto de carregamento, painel de erro, toast, lista de exercícios. | Ao mudar uma peça usada em mais de uma tela. |
| `js/utils/` | Funções puras, sem tela: CSV, validação de formulário, cálculos de desempenho, formatação, ordenação. | Ao mudar um cálculo ou formato usado em vários lugares. |
| `js/landing/` | A página inicial (`index.html`) e seus efeitos visuais. | Para mudar a página de apresentação. |
| `js/auth/` | Login, cadastro e a escolha de modo (Solo ou Professor). | Para mudar a entrada no sistema. |
| `js/professor/` | Telas do professor: turmas, turma, alunos, biblioteca de exercícios, relatórios. | Para mudar o mundo Escola do lado do professor. |
| `js/aluno/` | Telas do aluno: as salas, o detalhe de uma sala e o histórico. | Para mudar o mundo Escola do lado do aluno. |
| `js/solo/` | Telas do Solo: lobby, campanhas (missões) e estatísticas. | Para mudar o mundo Solo. |
| `js/treino/` | O motor de digitação (`typingEngine.ts`) e as telas de treino e de resultado, comuns aos dois mundos. | Para mudar como a digitação é medida ou exibida. |
| `pages/` | Os HTML de cada tela, separados por área (`aluno/`, `professor/`, `solo/`, `treino/`) mais login, cadastro e modo. Cada um só carrega o CSS e o `.js` da sua tela. | Para criar uma tela nova ou mudar o que uma página carrega. |
| `assets/` | Pastas para imagens, ícones e avatares. Hoje estão vazias. | Ao adicionar imagens. |
| `vendor/` | **Não é código do projeto.** React 18.3.1 e as fontes Inter e JetBrains Mono, baixados para dentro do projeto para o site funcionar sem internet. | Só para trocar a versão do React ou uma fonte. |
| `node_modules/` | **Não é código do projeto.** Dependências instaladas pelo `npm install` (o compilador TypeScript e os tipos do React). | Nunca. É recriada pelo `npm install`. |

**Todo `.js` dentro de `js/` é gerado pelo compilador.** A fonte é sempre o
`.ts` ou `.tsx` de mesmo nome, na mesma pasta. Editar o `.js` é trabalho
perdido: a próxima compilação escreve por cima.

Há um mapa mais detalhado de `js/` em [`js/README.md`](js/README.md).

## Regras que não podem ser quebradas

- **Só `js/nucleo/sessao.ts` lê ou grava o login no `localStorage`** (token e
  usuário). Motivo: um só lugar sabe o formato da sessão; o resto pergunta a
  ele.
- **Só `js/nucleo/api.ts` usa `fetch`.** Motivo: é ali que o token é
  anexado, o erro vira `ErroApi` e o mock é ligado ou desligado.
- **A digitação é capturada pelo evento `input`, nunca por `keydown`.**
  Motivo: no teclado ABNT2 o acento é uma tecla morta; o "á" só existe
  depois da vogal, e o `keydown` nunca o enxerga.
- **O texto de exercício não tem quebra de linha.** Motivo: o campo de
  captura é um `<input>`, que não aceita Enter; a biblioteca troca a quebra
  por espaço ao salvar.
- **Conta única: não existe perfil no banco.** Solo e Professor são modo,
  escolhido depois do login. Motivo: a tabela `Users` não tem coluna de
  perfil; qualquer conta abre os dois, e o que faz alguém ser professor é
  ser dono de turmas.
- **Aluno mora na tabela `Alunos`, com login separado** (RP e senha de
  aluno), ligada à conta dona pelo `UserID`. Toda conta ganha a sua no
  cadastro. O aluno não tem e-mail, e o nome dele é o da conta dona.
- **Quem está logado sai sempre do token, nunca de um id na URL.** Motivo:
  um id na URL pode ser trocado por qualquer um; o token é o que o back
  confere.
- **O `guarda.ts` é conveniência, não segurança.** Motivo: ele só evita que
  alguém veja uma tela quebrada; quem protege os dados é o back, validando o
  token em toda requisição.
- **Um `.ts`/`.tsx` nunca pode ter o nome de um `.js` que já existe na mesma
  pasta, mesmo com outra caixa** (`Modal.tsx` e `modal.js`). Motivo: o
  Windows não distingue maiúscula de minúscula, e o `.js` gerado sobrescreve
  o outro.

## Onde está o contrato com o back

- **`js/nucleo/api.ts`** lista todas as rotas que o front chama, agrupadas
  por assunto (`auth`, `solo`, `turmas`, `alunos`, `relatorios`,
  `exercicios`, `sessoes`, `aluno`, `admin`), com método HTTP, caminho e o
  tipo da resposta.
- **`js/nucleo/mocks.ts`** é como o back deve responder a cada uma dessas
  rotas: o formato exato de cada resposta e também os erros (400, 401, 403,
  404, 409), com mensagem e código.
- **`js/nucleo/tipos.ts`** descreve os formatos em TypeScript. Os nomes de
  campo seguem o que o back devolve.

Se o mock e o back discordarem, a tela quebra no dia da integração. Por isso
qualquer mudança no formato de uma resposta precisa ser feita nos dois.

## Stack e quem fez o quê

| Parte | Tecnologia | Responsável |
|-------|------------|-------------|
| Front | HTML, CSS, TypeScript e React 18 (sem bundler: o `tsc` compila e o navegador carrega os módulos direto) | Leonardo |
| Back  | Node.js com Express, na porta 3000 | Cauê |
| Banco | MySQL | Cauê |

Repositório: <https://github.com/leonardoluirodrigues1-lang/Teclar>
