# TECLAR — back-end

API do TECLAR em NestJS + Prisma, sobre o MySQL local (`teclardb`).
O que cada rota recebe e devolve está no `CONTRATO-API.md`, na raiz do
repositório.

**Rotas prontas:** as quatro de `/auth`; as de turmas, menos
`GET /turmas/:id` (listar, criar, PATCH, código novo e as três de
atribuições); as cinco de alunos da turma; e as cinco da biblioteca de
exercícios (o `DELETE /exercicios/:id` arquiva, não apaga). As outras estão
no contrato e no Swagger, marcadas "(ainda não implementada)", e ainda não
existem no back (respondem 404). Testes de fumaça, com o back no ar e o
seed aplicado: `npm run test:auth`, `test:turmas`, `test:atribuicoes`,
`test:alunos` e `test:exercicios`.

## Swagger

Com o back no ar: **http://localhost:3000/api/docs**
(o JSON do OpenAPI fica em http://localhost:3000/api/docs-json).

Para testar uma rota com cadeado: faça o `POST /api/auth/login` pelo
próprio Swagger, copie o `token` da resposta e cole em **Authorize**.

O Swagger não é montado a partir do código do back: ele mostra o
`back/openapi.json`, que o `gerar-contrato.mjs` (na raiz) gera do mesmo
`js/nucleo/api.ts` que gera o `CONTRATO-API.md`. Por isso documenta as 55
rotas do contrato, prontas ou não, sem controller vazio no back. Mudou o
contrato, ou implementou uma rota? Na raiz do repositório:

```bash
npm run contrato
```

Ao implementar uma rota, ponha a chamada dela (ex.: `'conta.rp'`) na lista
`ROTAS_IMPLEMENTADAS` do `gerar-contrato.mjs` e rode o comando acima: o
"(ainda não implementada)" sai do resumo dela.

O contrato tem 59 chamadas, e o Swagger mostra 55 rotas: o
`PATCH /turmas/:id` serve a quatro chamadas (renomear, trocar a capa,
arquivar, desarquivar) e o `GET /turmas` a duas (com e sem
`?ativa=false`). Cada uma dessas aparece uma vez, com as variantes
dentro.

## Primeira vez

Precisa de Node 20+ e do MySQL rodando com o banco já criado pelo
`DB_Teclar_v8.sql` (na raiz do repositório).

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

**Apaga** contas, alunos, turmas, exercícios e sessões e insere tudo de
novo. Rodar duas vezes dá o mesmo banco. Categorias e Configuracoes não
são tocadas (quem as semeia é o `.sql`). Os dados são os do mock do front,
com os mesmos ids e nomes, e as 76 lições do Solo vêm do mesmo arquivo que
o mock lê (`js/nucleo/licoes.ts`).

Contas (login por e-mail):

| E-mail | Senha | Para quê |
| --- | --- | --- |
| `prof@teclar.dev` | `senha123` | Professor: dono da turma-1, da turma-2 e de 11 exercícios |
| `leo@teclar.dev` | `senha123` | Solo: tem a campanha `camp-1` (nível 1, 0 XP) |

Alunos (login "Sou aluno": código da turma + nome + senha). O aluno é
**por turma** (banco v8): não tem RP nem conta, e o mesmo nome em duas
turmas são duas pessoas, cada uma com a sua senha e o seu histórico. Código
e nome não diferenciam maiúscula nem acento ("ana pires" entra).

| Código | Nome | Senha | Situação |
| --- | --- | --- | --- |
| `R8VD3K` | Ana Pires | `aluno2026` | Turma-2: o aluno de teste (3 sessões) |
| `K7M2QX` | Ana Pires | `aluno2026` | Turma-1: **outra** Ana, outro histórico (2 sessões) |
| `D6YG2S` | Ana Pires | `aluno2026` | Turma-5 (de leo): a terceira Ana |
| `K7M2QX` | Davi Moreira | qualquer, de 4 a 20 caracteres | **Primeiro acesso**: SenhaHash NULL, a senha digitada é gravada |
| `H3ZT6B` | Júlia Campos | qualquer, de 4 a 20 caracteres | **Primeiro acesso** |

Os outros alunos (Caio, Marina, Helena, os colegas do ranking da turma-2,
Igor) também entram com `aluno2026`. A turma-8 (`P4WN8R`) está arquivada e
não tem alunos. Para ver o 403 de turma arquivada:
`UPDATE ClassesProf SET Ativa = FALSE WHERE Codigo = 'D6YG2S';` e rode o
seed de novo para voltar.

Os códigos, nomes e senhas são os do mock (`js/nucleo/mocks.ts`). As
sessões são 9 (as do mock até a ses-10); o mock tem mais, para o histórico
e o ranking, que o seed ainda não copia.

## Login e token

`POST /api/auth/login` devolve um token JWT, assinado com o `JWT_SEGREDO`
do `.env` e válido por 8 horas. As outras rotas, quando existirem, vão
exigir o cabeçalho `Authorization: Bearer <token>`. Quem confere é o
`GuardaDoToken` (`src/autenticacao/guarda-do-token.ts`), que ainda não está
aplicado em nenhuma rota.

As senhas são guardadas com bcrypt (biblioteca `bcryptjs`: o mesmo
algoritmo do `bcrypt`, escrito em JavaScript puro, sem compilar nada na
instalação).

## O banco manda, o Prisma segue

O `DB_Teclar_v8.sql` é a fonte da verdade do banco. Os models do
`prisma/schema.prisma` **não são escritos à mão**: saem do `db pull`.
Mudou o banco? Muda o `.sql`, roda no MySQL e repete:

```bash
npx prisma db pull
npx prisma generate
```

Por isso este projeto não usa `prisma migrate`: as migrações ficam no
`.sql` (seção de ALTER TABLE no fim dele).

**O nome do banco é `teclardb`, em minúsculas — na URL também.** No
Windows o MySQL guarda nomes de banco e de tabela em minúsculas
(`lower_case_table_names = 1`), e o Prisma compara o banco de cada chave
estrangeira com o nome da `DATABASE_URL` diferenciando caixa. Com
`teclarDB` na URL, o `db pull` achava que as 15 FKs eram de "outro banco"
e trazia o schema sem nenhuma relação. Com `teclardb`, vêm as 15, e as
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
- A senha do aluno vai de 4 a 20 caracteres, sem exigir letra nem número,
  porque quem digita é criança. A regra forte (8+, letra e número) é só da
  senha de conta, no `POST /auth/cadastro`.
- O login apara as pontas da senha porque senha colada costuma trazer um
  espaço ou uma quebra de linha no fim. Isso só é seguro porque nenhuma
  senha válida tem espaço nas pontas: por isso o cadastro recusa esse caso
  (a tela barra antes, mas o back também precisa barrar). Uma conta criada
  com `"abc12345 "` nunca mais entraria.
- Conta não tem entrada de aluno: o aluno nasce da lista que o professor
  sobe na turma.

**Aluno, turma e código**

- O aluno não tem e-mail, então não existe "esqueci minha senha"
  automático. Quem desbloqueia é o professor, em
  `POST /turmas/:id/alunos/:alunoId/zerar-senha`. Até o aluno entrar de
  novo, qualquer um com o código e o nome dele pode criar a senha: a tela
  avisa para zerar só com o aluno por perto.
- `POST /turmas/:id/codigo/novo` existe para o código que vaza (foto da
  lousa no grupo errado): sem ele, qualquer um com o código e um nome da
  lista faria o primeiro acesso no lugar do aluno. O código só diz qual é a
  turma, por isso as senhas continuam valendo.
- O código da turma não usa I, O, 0 e 1 porque eles se confundem ao ditar.
- Turma é arquivada, nunca excluída: SessionsProf aponta para a turma com
  ON DELETE CASCADE, e apagar a turma apagaria o histórico de treino de
  todos os alunos dela.
- A importação é a única porta de entrada do aluno, por isso é obrigatória:
  sem o nome na lista, o login responde 401. Aluno removido por engano volta
  como linha nova, sem a senha e sem o histórico antigos.
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
- `GET /solo/missoes` não traz o texto das lições: seriam uns 30 KB que
  nenhum cartão mostra. ExerciciosSolo.NivelMinimo existe desde a v7, mas
  nenhuma rota o usa ainda (ver `naoUsadas` no `api.contrato.ts`).

**Sessões**

- `POST /sessoes` recusa com 400 um corpo que traga `usuario_id`, em vez
  de ignorar o campo. Ignorar em silêncio faria quem o mandou achar que
  escolheu o aluno, e a sessão seria gravada no dono do token.
- O campo do tempo é `tempo_gasto_segundos`, e não `tempo_segundos` como
  no guia do professor. O nome vem da coluna `Tempo_Gasto_Segundos` do
  banco, e usar o mesmo nome no banco, no back e no front evita tradução
  entre as camadas.

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
| `src/turmas/` | As rotas de turma do professor (listar, criar, PATCH, código novo) e o `turmaDaConta` que alunos e atribuições usam |
| `src/atribuicoes/` | Qual exercício foi dado a qual turma (`/turmas/:id/atribuicoes`) |
| `src/alunos/` | A lista de alunos de uma turma: importar, remover, zerar senha, desempenho |
| `src/exercicios/` | A biblioteca de exercícios do professor |
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
