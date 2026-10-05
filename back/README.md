# TECLAR — back-end

API do TECLAR em NestJS + Prisma, sobre o MySQL local (`teclarDB`).
O que cada rota recebe e devolve está no `CONTRATO-API.md`, na raiz do
repositório. Por enquanto **nenhuma rota está implementada**: só a base
(conexão com o banco, CORS, um módulo vazio por grupo do contrato).

## Primeira vez

Precisa de Node 20+ e do MySQL rodando com o banco já criado pelo
`DB_Teclar_v7.sql` (na raiz do repositório).

```bash
cd back
npm install

# 1. Crie o .env a partir do modelo e troque SENHA pela senha do root do MySQL.
cp .env.example .env

# 2. Gere o schema do Prisma A PARTIR DO BANCO e, dele, o client.
npx prisma db pull
npx prisma generate
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

## O banco manda, o Prisma segue

O `DB_Teclar_v7.sql` é a fonte da verdade do banco. Os models do
`prisma/schema.prisma` **não são escritos à mão**: saem do `db pull`.
Mudou o banco? Muda o `.sql`, roda no MySQL e repete:

```bash
npx prisma db pull
npx prisma generate
```

Por isso este projeto não usa `prisma migrate`: as migrações ficam no
`.sql` (seção de ALTER TABLE no fim dele).

Para olhar as tabelas e os dados pelo Prisma, no navegador:

```bash
npx prisma studio
```

## Onde fica cada coisa

| Caminho | O que é |
| --- | --- |
| `src/main.ts` | Ponto de entrada: porta, prefixo `/api`, CORS |
| `src/app.module.ts` | Junta o banco e os módulos de rota |
| `src/banco/` | A conexão: o client do Prisma como serviço do Nest |
| `src/<grupo>/` | Um módulo por grupo de rotas do contrato (vazios por enquanto) |
| `prisma/schema.prisma` | Gerado pelo `db pull` — não editar os models à mão |
| `prisma.config.ts` | Configuração da CLI do Prisma (lê o `DATABASE_URL`) |
| `.env` | A senha do banco. Fora do git; o modelo é o `.env.example` |

Os grupos e suas pastas:

| Grupo no contrato | Pasta |
| --- | --- |
| Autenticação | `autenticacao/` |
| Conta | `conta/` |
| Solo | `solo/` |
| Turmas (professor) | `turmas/` |
| Alunos e convites (professor) | `alunos-e-convites/` |
| Relatórios (professor) | `relatorios/` |
| Biblioteca de exercícios (professor) | `exercicios/` |
| Sessões | `sessoes/` |
| Aluno | `aluno/` |
| Administração | `administracao/` |

## Versões

- NestJS 12, em ESM (`"type": "module"`): por isso os imports entre
  arquivos nossos terminam em `.js`, mesmo o arquivo sendo `.ts`.
- Prisma 7.10.0, fixado sem `^`. O `latest` do npm aponta para uma versão
  candidata do Prisma 8 (rc), que não é para trabalho que precisa ficar de pé.
  No Prisma 7 o client conecta por um *driver adapter*: para MySQL é o
  `@prisma/adapter-mariadb`.
