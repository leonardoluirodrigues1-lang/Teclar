# TECLAR

Plataforma web de treino de digitação, feita no Projeto Integrador do IFSP.
A pessoa digita um texto e o sistema mede a velocidade (PPM, palavras por
minuto) e a precisão, caractere por caractere.

Dois mundos, com a mesma tela de treino e o mesmo motor de digitação
(`js/treino/typingEngine.ts`):

- **Solo**: quem tem conta treina sozinho, numa campanha com níveis, missões
  e XP.
- **Escola**: o professor (também uma conta) cria turmas, importa os nomes
  dos alunos por CSV e atribui exercícios. O aluno entra com o **código da
  turma, o próprio nome e uma senha**; no primeiro acesso, a senha que ele
  digita é gravada. O aluno não tem e-mail nem conta, e não há convites.

## Arquitetura

| Camada | Tecnologia | Onde |
|---|---|---|
| Apresentação | HTML, CSS, TypeScript e React 18 (sem empacotador: o `tsc` gera um `.js` ao lado de cada `.ts`/`.tsx`) | `pages/`, `js/`, `css/` |
| Aplicação | Node.js com NestJS, login com JWT, senhas com bcrypt | `back/src/` |
| Persistência | MySQL, acessado pelo Prisma | `DB_Teclar_v9.sql`, `back/prisma/` |

- `js/nucleo/api.ts` é o único arquivo do front que fala com o back.
- Quem está logado sai sempre do token, nunca de um id mandado pela tela.
- `DB_Teclar_v9.sql` é a fonte da verdade do banco; o schema do Prisma é
  gerado dele (`npx prisma db pull`).
- O contrato das rotas está em `CONTRATO-API.md` (gerado do `api.ts`) e no
  Swagger, em `http://localhost:3000/api/docs`.

## Como rodar

Precisa de Node.js 20+, MySQL e do VS Code com a extensão **Live Server**.

1. **Banco.** Rode `DB_Teclar_v9.sql` no MySQL. Ele cria o banco `teclardb`.
2. **Back.** Siga `back/README.md` (criar o `.env`, `npx prisma db pull`,
   `npx prisma generate`, `npm run seed`) e suba com:

   ```
   cd back
   npm run start:dev
   ```

   Sobe em `http://localhost:3000/api`.
3. **Front.** Na pasta `teclar`:

   ```
   npm install
   npm run dev
   ```

   Deixe esse terminal aberto: ele recompila a cada arquivo salvo.
4. Abra a pasta `teclar` no VS Code e clique em **Go Live**. Não abra o
   `index.html` com duplo clique: os módulos só carregam por um servidor.

### Logins de teste (criados pelo `npm run seed`)

| Tipo | Login | Senha |
|---|---|---|
| Professor | `prof@teclar.dev` | `senha123` |
| Solo | `leo@teclar.dev` | `senha123` |
| Administradora | `ana@teclar.dev` | `senha123` |
| Aluno | código `R8VD3K`, nome `Ana Pires` | `aluno2026` |
| Aluno (primeiro acesso) | código `K7M2QX`, nome `Davi Moreira` | qualquer, de 4 a 20 caracteres |

A lista completa está em `back/README.md`.

## Testes

- Back: `npm run test:<grupo>` dentro de `back/` (ex.: `test:sessoes`), com
  o back rodando.
- Front contra o back: `node js/nucleo/api.back.check.mjs`.
- Para rodar o front sem back, ponha `MOCK: true` em `js/config.ts` e rode
  `npx tsc`: as telas passam a usar `js/nucleo/mocks.ts`.

## Mapa das pastas

| Pasta | O que tem |
|---|---|
| `pages/` | Um HTML por tela: `aluno/`, `professor/`, `solo/`, `treino/`, login, cadastro e modo. |
| `js/nucleo/` | `api` (fala com o back), `sessao` (quem está logado), `guarda` (quem abre cada tela), `tipos`, `mocks`. |
| `js/auth/`, `js/aluno/`, `js/professor/`, `js/solo/`, `js/treino/` | As telas de cada área. |
| `js/componentes/`, `js/utils/` | Peças de tela e funções puras reaproveitadas. |
| `css/` | Estilos: `base/`, `componentes/` e um arquivo por área. |
| `vendor/` | React e fontes copiados, para funcionar sem internet. Não é código do projeto. |
| `back/` | O servidor NestJS, o Prisma, o seed e os testes. |

Todo `.js` em `js/` é gerado: edite sempre o `.ts`/`.tsx` de mesmo nome.

Repositório: <https://github.com/leonardoluirodrigues1-lang/Teclar>
