# TECLAR — back-end

API do TECLAR em NestJS + Prisma, sobre o MySQL local (`teclardb_v10`).
O que cada rota recebe e devolve está no `CONTRATO-API.md`, na raiz do
repositório.

**Rotas prontas: todas as do contrato.** As quatro de `/auth`; as dez do
Solo (campanha, lições, sessões com XP, histórico, indicadores e
estatísticas); as de turmas (listar, criar, detalhe, PATCH, código novo e
as três de atribuições); as cinco de alunos da turma; as cinco da
biblioteca de exercícios (o `DELETE /exercicios/:id` arquiva, não apaga);
as duas de sessões; as quatro de relatórios; as seis do próprio aluno
(histórico, resumo, salas, sala, meu desempenho e o ranking); e as seis de
administração (categorias e parâmetros). Testes de fumaça, com o back no
ar e o seed aplicado: `npm run test:auth`, `test:solo`, `test:turmas`,
`test:atribuicoes`, `test:alunos`, `test:exercicios`, `test:sessoes`,
`test:relatorios`, `test:aluno`, `test:ranking` e `test:administracao`.
`npm run test:seed` roda o seed duas vezes e confere que só a demonstração
volta ao começo.

### Contas de teste (`npm run limpar-testes`)

O seed não apaga as contas do cadastro, e os testes criam contas pelo
cadastro. `npm run limpar-testes` apaga só as contas de e-mail
`teste-…@teclar.dev` ou `solo-…@teclar.dev` e tudo o que é delas (turmas,
alunos, exercícios, sessões, campanhas). A demonstração e as lições do Solo
ficam. Antes de apagar, mostra o banco-alvo e quantas contas vão sair, e só
segue confirmado:

- `--local`: só com o banco nesta máquina (localhost, 127.0.0.1, ::1);
- `--confirmar=<host>/<banco>`: qualquer banco, escrito igual ao que o
  script mostra;
- sem nada, num terminal: pergunta o `<host>/<banco>`.

As 12 suítes e o `js/nucleo/api.back.check.mjs` rodam o
`limpar-testes -- --local` sozinhos no fim (passando ou falhando), pelo
`test/limpar-no-fim.mjs`.

**Regra:** suíte ou `api.back.check` rodados contra a produção (o TiDB)
deixam as contas lá — o `--local` recusa banco remoto. Logo depois, rode no
TiDB, com o `DATABASE_URL` dele só no ambiente:

```
npm run limpar-testes -- --confirmar=<host-do-tidb>/teclardb_v10
```

## Swagger

Com o back no ar: **http://localhost:3000/api/docs**
(o JSON do OpenAPI fica em http://localhost:3000/api/docs-json).

Para testar uma rota com cadeado: faça o `POST /api/auth/login` pelo
próprio Swagger, copie o `token` da resposta e cole em **Authorize**.

O Swagger não é montado a partir do código do back: ele mostra o
`back/openapi.json`, que o `gerar-contrato.mjs` (na raiz) gera do mesmo
`js/nucleo/api.ts` que gera o `CONTRATO-API.md`. Por isso documenta as 50
rotas do contrato a partir do contrato, e não do código. Mudou o
contrato, ou implementou uma rota? Na raiz do repositório:

```bash
npm run contrato
```

Ao implementar uma rota, ponha a chamada dela (ex.: `'conta.rp'`) na lista
`ROTAS_IMPLEMENTADAS` do `gerar-contrato.mjs` e rode o comando acima: o
"(ainda não implementada)" sai do resumo dela.

O contrato tem 55 chamadas, e o Swagger mostra 51 rotas: o
`PATCH /turmas/:id` serve a quatro chamadas (renomear, trocar a capa,
arquivar, desarquivar) e o `GET /turmas` a duas (com e sem
`?ativa=false`). Cada uma dessas aparece uma vez, com as variantes
dentro.

## Primeira vez

Precisa de Node 20+ e do MySQL rodando com o banco `teclardb_v10` já
criado pelo `DB_Teclar_v10.sql` (na raiz do repositório).

- **Instalação do zero** (o caminho normal): `DB_Teclar_v10.sql` e depois
  os passos abaixo. Já traz tudo, inclusive `licoes_por_nivel`,
  `TentativaID` e os CHECKs das medidas.
- **`teclardb_v10` já criado antes desses complementos:** rode uma vez o
  `ALTER_v10_complementos.sql` (o próprio arquivo diz como conferir os
  dados antes dos CHECKs) e depois o passo 2.
- **`teclardb_v10` já criado antes da senha provisória do aluno:** rode
  uma vez o `ALTER_v10_senha_provisoria.sql` e depois o passo 2.
- **Banco v9 (`teclardb`):** não há migração. Ele só tinha dados de
  teste/demonstração; o deploy deve ser **recriado do zero** com
  `DB_Teclar_v10.sql` + `npm run seed`.

```bash
cd back
npm install

# 1. Crie o .env a partir do modelo. Troque SENHA pela senha do root do
#    MySQL e JWT_SEGREDO por um texto aleatório (o .env.example diz como gerar).
cp .env.example .env

# 2. Gere o schema do Prisma A PARTIR DO BANCO e, dele, o client.
npx prisma db pull
npx prisma generate

# 3. Ponha dados de teste no banco.
npm run seed
```

O passo 2 é obrigatório: sem o client gerado (`src/generated/prisma`, fora
do git) o back nem compila.

## Subir

```bash
npm run start:dev
```

Sobe em `http://localhost:3000/api`, e reinicia sozinho a cada arquivo
salvo. Na subida o back faz uma consulta de teste no banco: se aparecer
`Conectado ao banco.` no log, está tudo certo. Se aparecer
`Não consegui conectar ao MySQL`, confira a senha no `.env` e se o serviço
do MySQL está ligado.

O prefixo `/api` e a porta 3000 são os que o front espera
(`CONFIG.BASE_URL` em `js/config.ts`). O CORS libera só o Live Server:
`http://127.0.0.1:5500` e `http://localhost:5500`.

## Dados de teste (`npm run seed`)

**Não destrutivo**: apaga e recria só a demonstração, isto é, as três
contas do seed (pelos ids `u-1` a `u-3` ou pelos e-mails `leo@`, `prof@` e
`ana@teclar.dev`) e tudo o que pende delas: campanhas e sessões Solo,
exercícios, turmas (as do seed e qualquer outra criada nessas contas, como as
dos testes), vínculos, alunos, matrículas, atribuições e sessões. Contas
criadas pelo cadastro, e tudo ligado a elas, **não são tocadas**: dá para
rodar no banco da apresentação sem perder as contas de verdade. As 76 lições
do Solo são atualizadas no lugar (upsert), nunca apagadas, porque as sessões
Solo de qualquer conta apontam para elas. Rodar duas vezes dá a mesma demo
(`npm run test:seed` confere isso, e que uma conta do cadastro com turma,
aluno e sessões sai intacta). Categorias e Configuracoes não
são tocadas (quem as semeia é o `.sql`). Os dados são os do mock do front,
com os mesmos ids e nomes, e as 76 lições do Solo vêm do mesmo arquivo que
o mock lê (`js/nucleo/licoes.ts`).

Contas (login por e-mail):

| E-mail | Senha | Para quê |
| --- | --- | --- |
| `prof@teclar.dev` | `senha123` | Professor: dono da turma-1, da turma-2 e de 11 exercícios |
| `leo@teclar.dev` | `senha123` | Solo: tem a campanha `camp-1` (nível 1, 0 XP) |
| `ana@teclar.dev` | `senha123` | Sem campanha e sem turma (os estados vazios); a **única administradora** (`Users.Administrador`): só ela usa as rotas de escrita de categorias e parâmetros |

Alunos (login "Sou aluno": código da turma + nome + senha). O aluno é
**por matrícula** (banco v10, tabela `alunosturmas`): **matrícula = login**.
Não tem RP nem conta, e o mesmo nome em duas turmas são duas matrículas,
cada uma com a sua senha e o seu histórico (zerar uma não afeta a outra). Código
e nome não diferenciam maiúscula nem acento ("ana pires" entra).

| Código | Nome | Senha | Situação |
| --- | --- | --- | --- |
| `R8VD3K` | Ana Pires | `aluno2026` | Turma-2: o aluno de teste (3 sessões, nos 3 dias até ontem: 3 dias seguidos e a estrela "Mandou bem!") |
| `K7M2QX` | Ana Pires | `aluno2026` | Turma-1: **outra** Ana, outro histórico (2 sessões) |
| `D6YG2S` | Ana Pires | `aluno2026` | Turma-5 (de leo): a terceira Ana |
| `K7M2QX` | Davi Moreira | `davi26` (senha provisória) | **Esqueceu a senha**: o professor gerou a provisória; entra com ela e cai em "Crie sua senha". Uso único: para repetir a demo, rode `npm run seed` de novo (ou gere outra provisória na turma) |
| `K7M2QX` | qualquer nome novo (ex.: `Rafa Lima`) | a que você criar (6 a 20, letra e número, ex.: `rex2015`) | **Primeiro acesso**: o aluno se matricula sozinho e entra |

Os outros alunos (Caio, Marina, Helena, os colegas do ranking da turma-2,
Igor, Júlia) também entram com `aluno2026`. A turma-8 (`P4WN8R`) está arquivada e
não tem alunos. Para ver o 403 de turma arquivada:
`UPDATE ClassesProf SET Ativa = FALSE WHERE Codigo = 'D6YG2S';` e rode o
seed de novo para voltar.

Os códigos, nomes e senhas são os do mock (`js/nucleo/mocks.ts`). As
sessões são as 9 do mock até a ses-10, mais as dos colegas da Ana na
turma-2 (Bruno a Gabriela), espalhadas pelos últimos 14 dias: o ranking da
turma-2 sai com os mesmos pontos do mock (146, 134, 132, 122, 118, 86), com
a Ana em 7º e a Helena, que nunca treinou, em 8º com "—" no relatório. Os
dias seguidos contam a partir do dia em que o seed roda: rode o seed no dia
da demonstração (no dia seguinte ainda vale; depois a sequência vira 0).
Todas as sessões do seed respeitam a liberação em ordem, e os testes sujam os
dados de demonstração: rode o seed de novo antes de mostrar a tela.

## Login e token

`POST /api/auth/login` devolve um token JWT, assinado com o `JWT_SEGREDO`
do `.env` e válido por 8 horas. Todas as outras rotas, menos cadastro e
logout, exigem o cabeçalho `Authorization: Bearer <token>`. Quem confere é
o `GuardaDoToken` (`src/autenticacao/guarda-do-token.ts`), posto em cada
controller.

As senhas são guardadas com bcrypt (biblioteca `bcryptjs`: o mesmo
algoritmo do `bcrypt`, escrito em JavaScript puro, sem compilar nada na
instalação).

## O banco manda, o Prisma segue

O `DB_Teclar_v10.sql` é a fonte da verdade do banco. Os models do
`prisma/schema.prisma` **não são escritos à mão**: saem do `db pull`.
Mudou o banco? Muda o `.sql`, roda no MySQL e repete:

```bash
npx prisma db pull
npx prisma generate
```

Por isso este projeto não usa `prisma migrate`: o que muda num banco
v10 já criado fica em `ALTER_v10_complementos.sql`.

**O nome do banco é `teclardb_v10`, em minúsculas — na URL também.** No
Windows o MySQL guarda nomes de banco e de tabela em minúsculas
(`lower_case_table_names = 1`), e o Prisma compara o banco de cada chave
estrangeira com o nome da `DATABASE_URL` diferenciando caixa. Com
`teclarDB` na URL, o `db pull` achava que as FKs eram de "outro banco"
e trazia o schema sem nenhuma relação. Em minúsculas, vêm todas, e as
rotas podem usar `include` (ex.: o aluno junto com a turma dele).
Os models também vêm em minúsculas (`users`, `alunos`...) pelo mesmo motivo.

Se um dia o `db pull` voltar sem `@relation` no schema, confira a caixa do
nome do banco no `.env` antes de qualquer outra coisa.

Para olhar as tabelas e os dados pelo Prisma, no navegador:

```bash
npx prisma studio
```

## Decisões de implementação

O Swagger diz só a regra de cada rota. O porquê fica aqui.

**Login e senha**

- `tipo` vem da tabela em que o back autenticou, nunca do que a tela
  mandou.
- Código, nome ou senha errados dão o mesmo 401 para o login não virar um
  jeito de descobrir quem está em qual turma.
- A comparação do nome sem maiúscula e acento é a collation do banco
  ("ana pires" acha "Ana Pires"), a mesma do UNIQUE (ClassID, Nome).
- A senha do aluno vai de 6 a 20 caracteres, com pelo menos uma letra e um
  número; a tela mostra a dica e um medidor fraca/boa/forte. A senha de
  conta (8+, letra e número, sem espaço nas pontas) é do `POST /auth/cadastro`.
- O login apara as pontas da senha porque senha colada costuma trazer um
  espaço ou uma quebra de linha no fim. Isso só é seguro porque nenhuma
  senha válida tem espaço nas pontas: por isso o cadastro recusa esse caso
  (a tela barra antes, mas o back também precisa barrar). Uma conta criada
  com `"abc12345 "` nunca mais entraria.
- Conta não tem entrada de aluno: o aluno entra pela turma (abaixo).

**Aluno, turma e código: o fluxo de entrada**

1. O professor passa o código da turma para a sala (está no topo da turma
   e na aba Alunos). Ele não cadastra ninguém.
2. Passo 1 da tela: o aluno digita o código; `GET /auth/turmas/:codigo`
   devolve o nome da turma (404 `TURMA_NAO_ENCONTRADA`, 403
   `TURMA_ARQUIVADA`).
3. Passo 2: nome completo + senha em `POST /auth/aluno`. Nome que ainda não
   está na turma é o **primeiro acesso**: o ID em `alunos` e a matrícula em
   `alunosturmas` nascem numa transação, com o bcrypt da senha que ele
   escolheu. Nome que já está é login normal; senha errada dá 401 "Senha
   incorreta." (a tela completa: "Se esqueceu, peça ao professor uma senha
   provisória."). Dois aparelhos com o mesmo nome ao mesmo tempo: o UNIQUE
   (ClassID, Nome) recusa o segundo com 409 `NOME_EM_USO` ("use também seu
   sobrenome"). Mesmo limite de senhas erradas do login (a mesma contagem).

- Quem esqueceu a senha recebe do professor uma **senha provisória**
  (6 letras e números, bcrypt em `SenhaProvisoriaHash`, validade de 7 dias
  em `SenhaProvisoriaExpira`), mostrada em texto uma vez só. O login com ela
  a apaga (uso único) e responde `usuario.precisaTrocarSenha: true`; o
  aluno cria a dele em `POST /aluno/senha`.
- `POST /turmas/:id/alunos/importar` ficou **obsoleta**: continua no back
  (as suítes ainda a usam para montar turmas de teste), sem tela.
- O aluno não tem e-mail, então não existe "esqueci minha senha"
  automático. Quem desbloqueia é o professor, em
  `POST /turmas/:id/alunos/:alunoId/senha-provisoria`: a senha antiga deixa
  de valer e sai uma provisória nova.
- Banco já criado antes disso: rode `ALTER_v10_senha_provisoria.sql` (na
  raiz) uma vez, antes do seed.
- `POST /turmas/:id/codigo/novo` existe para o código que vaza (foto da
  lousa no grupo errado). O código só diz qual é a turma, por isso as senhas
  continuam valendo.
- O código da turma não usa I, O, 0 e 1 porque eles se confundem ao ditar.
- Turma é arquivada, nunca excluída: SessionsProf aponta para a turma com
  ON DELETE CASCADE, e apagar a turma apagaria o histórico de treino de
  todos os alunos dela.
- Aluno removido ("Remover da turma") pode entrar de novo com o código,
  mas volta como matrícula nova, sem a senha e sem o histórico antigos.
- Na v8 cada aluno é de uma turma só, então "as sessões dele" e "as sessões
  dele nesta turma" são a mesma coisa. `GET /aluno/salas` continua lista
  para a tela não mudar de forma.
- A atribuição confere todos os ids antes de gravar porque metade atribuída
  é pior que nada.
- A visão do aluno sobre as atribuições não traz contagem da turma: seria
  entregar o desempenho dos colegas.

**Ranking**

- O nome dos colegas não pode chegar ao navegador, nem escondido: por isso
  a anonimização do 4º lugar em diante é do back.
- Lição pesa mais que tudo (20 pontos): quem fez mais exercícios fica na
  frente de quem só digita rápido. O ritmo entra a 1 ponto por PPM, e cada
  dia seguido vale 5, para a constância contar. Nunca é velocidade pura.

**Solo**

- `GET /solo/campanha` sem campanha responde null, e não 404: é a primeira
  vez do jogador, e o lobby mostra o convite de começar. Um 404 obrigaria a
  tela a tratar isso dentro de um catch.
- `POST /solo/campanha` é idempotente por causa de clique duplo, aba
  duplicada e F5. Não tem corpo porque CampanhaID, NivelAtual, XPTotal,
  Data_Criacao e Ativo são do back, e JogadorID sai do token.
- "Um jogador, uma campanha" é garantido pelo banco: UNIQUE em
  `CampanhasSolo.JogadorID` (banco v10). O back tenta o INSERT direto; se o
  banco recusar (outra requisição do mesmo jogador criou primeiro), relê
  e devolve a campanha que existe, com 200. Uma consulta antes do INSERT
  não bastaria: dois pedidos simultâneos passariam os dois por ela.
- `GET /solo/missoes` não traz o texto das lições: seriam uns 30 KB que
  nenhum cartão mostra. ExerciciosSolo.NivelMinimo existe desde a v7, mas
  nenhuma rota o usa ainda (ver `naoUsadas` no `api.contrato.ts`): o
  `bloqueada` da lista sai da ordem do caminho, não do nível.
- XP e nível são calculados no back (`src/solo/xp.ts`), nunca na tela: se
  a tela mandasse o XP, bastava mandar outro número para subir de nível.
  O XP por nível vem da tabela Configuracoes (o mesmo número que
  `GET /parametros` dá ao lobby para desenhar a barra), e o XP base de
  50 é constante, igual para toda lição.
- O progresso nunca regride. Não existe tabela de "progresso por lição"
  que uma sessão ruim pudesse sobrescrever: cada treino é uma linha nova
  em SessionsSolo, o XP só soma, e "lição concluída" e "melhor marca" são
  calculadas sobre todas as sessões (concluída se ALGUMA foi; a marca é
  a maior). Refazer pior acrescenta uma tentativa e nada mais.
- A sessão e o XP são gravados numa transação, com o XP somado pelo
  banco (`increment`): duas sessões ao mesmo tempo não perdem XP.
- `GET /solo/missoes/:id` aceita token de aluno: o contrato abre essa rota
  a qualquer token, porque a lição não é de ninguém. As outras nove do
  Solo são só de conta.
- `DELETE /solo/campanhas/:id` apaga de verdade (as sessões vão junto, pelo
  CASCADE). O contrato pede exclusão lógica em categorias e exercícios,
  não aqui, e a campanha é só do jogador. Nenhuma tela chama.

**Administração**

- Administrador é a coluna `Users.Administrador` (banco v10), e não um
  perfil: a mesma conta continua jogando e dando aula. A coluna é lida do
  banco a cada pedido, e não guardada no token, para tirar o papel de
  alguém valer na hora.
- Para quem não é administrador, as rotas de escrita respondem 404 antes
  de qualquer validação: nem as regras de nome vazam.
- `PUT /parametros` confere todos os campos antes de gravar e recusa campo
  desconhecido (um `xpNivel` com erro de digitação daria a impressão de
  ter mudado o XP por nível).

**Sessões**

- `POST /sessoes` recusa com 400 um corpo que traga `usuario_id`, em vez
  de ignorar o campo. Ignorar em silêncio faria quem o mandou achar que
  escolheu o aluno, e a sessão seria gravada no dono do token.
- O campo do tempo é `tempo_gasto_segundos`, e não `tempo_segundos` como
  no guia do professor. O nome vem da coluna `Tempo_Gasto_Segundos` do
  banco, e usar o mesmo nome no banco, no back e no front evita tradução
  entre as camadas.
- `tentativa_id` (opcional) torna o envio idempotente: a fila do front
  (`filaSessoes`) gera um por tentativa, e o reenvio com o mesmo id
  devolve a sessão já gravada (no Solo, sem XP de novo). Quem garante é o
  UNIQUE do banco (por campanha no Solo, por turma + aluno na Escola), não
  uma consulta antes do INSERT. No Solo o XP sobe ANTES do INSERT, para
  travar a campanha: na ordem inversa, dois envios simultâneos davam
  deadlock pelo lock da FK.
- O banco recusa medidas fora da faixa (CHECK: precisão 0 a 100; WPM,
  acertos, erros e tempo ≥ 0) e uma sessão de aluno numa turma que não é a
  dele (FK composta `(ClassID, AlunoID)` para `alunosturmas`).
- O nível escolar sai das lições distintas concluídas:
  `nivelAtual = 1 + floor(licoes / licoes_por_nivel)` (`Configuracoes`,
  3 por padrão); repetir uma lição não sobe o nível.

- As atividades liberam em ordem (`src/sessoes/liberacao.ts`, uma regra só
  para o Solo e para o aluno; o professor não entra nela). Quem grava fora de
  ordem recebe 403 `ATIVIDADE_BLOQUEADA`: a tela só esconde, quem garante é o
  back. Não há coluna de progresso: tudo sai das sessões, e "concluída" é ter
  ao menos uma com `Concluida = true`. Tempo esgotado não libera a seguinte,
  mas continua contando em `exerciciosFeitos`.
- A ordem do Solo existe em dois lugares (`ordemDoPercurso` aqui e em
  `js/utils/percurso.ts`) porque o build do back não enxerga `js/`. O
  `testar-solo.mjs` confere o caso que os distingue da ordem do número: a 49
  vem depois da 8.

**Pendência do mock**

- O mock ainda não valida o nome no `POST /turmas` (só no PATCH); a tela
  valida antes.

## Onde fica cada coisa

| Caminho | O que é |
| --- | --- |
| `src/main.ts` | Ponto de entrada: porta, prefixo `/api`, CORS |
| `src/app.module.ts` | Junta o banco e os módulos que têm rota implementada |
| `src/swagger.ts` | Serve o `openapi.json` em `/api/docs` |
| `src/banco/` | A conexão: o client do Prisma como serviço do Nest |
| `src/autenticacao/` | O login, o token, o guard e as regras de identidade do professor (`professor-do-token.ts`) |
| `src/turmas/` | As rotas de turma do professor (listar, criar, detalhe, PATCH, código novo) e o `turmaDaConta` que alunos e atribuições usam |
| `src/atribuicoes/` | Qual exercício foi dado a qual turma (`/turmas/:id/atribuicoes`) |
| `src/alunos/` | A lista de alunos de uma turma: importar, remover, zerar senha, desempenho |
| `src/exercicios/` | A biblioteca de exercícios do professor |
| `src/sessoes/` | Gravar e reler sessão; e o que as outras rotas reaproveitam: a forma da sessão e as médias (`sessao-escola.ts`), a conferência do pacote do motor (`medidas-da-sessao.ts`), os dias seguidos (`dias-seguidos.ts`) e a liberação em ordem (`liberacao.ts`) |
| `src/relatorios/` | Os quatro relatórios do professor |
| `src/ranking/` | O ranking da turma, visto pelo aluno (anonimizado aqui, no back) |
| `src/solo/` | O mundo Solo: a campanha, as lições, e o progresso (sessões, XP, histórico, indicadores, estatísticas); a conta do XP fica em `xp.ts` |
| `src/aluno/` | As telas do próprio aluno logado: histórico, resumo, salas e o relatório dele na sala |
| `src/administracao/` | Categorias e parâmetros globais, e a regra de quem é administrador |
| `openapi.json` | O Swagger, gerado do contrato — não editar à mão |
| `prisma/schema.prisma` | Gerado pelo `db pull` — não editar os models à mão |
| `prisma/seed.ts` | Os dados de teste (`npm run seed`) |
| `prisma.config.ts` | Configuração da CLI do Prisma (lê o `DATABASE_URL`) |
| `.env` | Senha do banco e segredo do JWT. Fora do git; o modelo é o `.env.example` |

## Versões

- NestJS 12, em ESM (`"type": "module"`): por isso os imports entre
  arquivos nossos terminam em `.js`, mesmo o arquivo sendo `.ts`.
- Prisma 7.10.0, fixado sem `^`. O `latest` do npm aponta para uma versão
  candidata do Prisma 8 (rc), que não é para trabalho que precisa ficar de pé.
  No Prisma 7 o client conecta por um *driver adapter*: para MySQL é o
  `@prisma/adapter-mariadb`.
