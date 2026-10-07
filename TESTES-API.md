# Testes da API — TECLAR

Complemento do Swagger (`/api/docs`) e do `CONTRATO-API.md`: o que foi
testado no back, o que se observou e o que ainda falta.

## 1. Tabela de testes

**Como foi testado.** Em 06/10/2026, às 22h31, contra o back local
(`http://localhost:3000/api`, build atual), com os dados de teste do
`npm run seed`. Cada cenário é uma requisição HTTP feita por um script Node
(`fetch`), sem navegador. Onde o cenário grava no banco, a coluna
`Alunos.SenhaHash` foi lida antes e depois.

O seed não tem aluno em turma arquivada. Para o último cenário, a turma-1
foi arquivada (`ClassesProf.Ativa = false`) só durante o teste. No fim, o
seed rodou de novo e devolveu o banco ao estado inicial.

| Rota | Cenário | Resultado esperado | Resultado observado | Situação |
| --- | --- | --- | --- | --- |
| POST /auth/login | Conta com e-mail e senha corretos (`prof@teclar.dev`) | 200, token, `tipo: "conta"` | 200, token, `tipo: "conta"`, id `u-2` (Henrique Lima) | Conforme |
| POST /auth/login | Aluno com código, nome e senha corretos (`K7M2QX`, "Ana Pires") | 200, token, `tipo: "aluno"` | 200, token, `tipo: "aluno"`, id `al-43-t1` (a Ana da turma-1) | Conforme |
| POST /auth/login | Aluno com o nome em minúscula e sem acento ("fabio mendes" para "Fábio Mendes", `R8VD3K`) | 200: a comparação ignora maiúscula e acento | 200, token, id `al-54`, nome devolvido "Fábio Mendes" | Conforme |
| POST /auth/login | Primeiro acesso: aluno com `SenhaHash` NULL ("Davi Moreira", `K7M2QX`) manda uma senha válida | 200 com `primeiroAcesso: true`; a senha é gravada | 200, `primeiroAcesso: true`; `SenhaHash` era NULL antes e ficou preenchido depois | Conforme |
| POST /auth/login | Segundo acesso do mesmo aluno, com a senha gravada | 200, sem `primeiroAcesso`: a senha é conferida | 200, token, sem `primeiroAcesso` | Conforme |
| POST /auth/login | Segundo acesso do mesmo aluno, com outra senha | 401 CREDENCIAIS: a senha gravada não é trocada | 401 CREDENCIAIS, "Credenciais inválidas." | Conforme |
| POST /auth/login | Aluno com senha errada ("Ana Pires", `K7M2QX`) | 401 CREDENCIAIS | 401 CREDENCIAIS, "Credenciais inválidas." | Conforme |
| POST /auth/login | Conta com senha errada (`prof@teclar.dev`) | 401 CREDENCIAIS | 401 CREDENCIAIS, "Credenciais inválidas." | Conforme |
| POST /auth/login | Primeiro acesso com senha de 3 caracteres ("Júlia Campos", `H3ZT6B`) | 400 DADOS_INVALIDOS; nada é gravado | 400 DADOS_INVALIDOS, "Falta 1 caractere." | Conforme |
| POST /auth/login | Primeiro acesso com senha de 21 caracteres (mesma aluna) | 400 DADOS_INVALIDOS; nada é gravado | 400 DADOS_INVALIDOS, "A senha pode ter no máximo 20 caracteres."; `SenhaHash` continuou NULL depois dos dois testes | Conforme |
| POST /auth/login | Aluno de turma arquivada ("Ana Pires", `K7M2QX`, com a turma-1 arquivada) | 403 CONTA_INATIVA | 403 CONTA_INATIVA, "Esta turma foi arquivada." | Conforme |
| As 53 chamadas não implementadas (49 operações HTTP) | Chamar cada uma delas, uma requisição por operação | 404: estão documentadas no Swagger como "(ainda não implementada)" | 404 nas 49 operações | Conforme |

As 53 chamadas cabem em 49 operações porque `PATCH /turmas/:id` serve a
quatro chamadas (renomear, trocar capa, arquivar, desarquivar) e
`GET /turmas` serve a duas (ativas e arquivadas).

## 2. Lista de pendências

### Rotas não implementadas (53)

Só `POST /auth/login` está implementada. Faltam, por módulo:

1. **Autenticação (3):** `POST /auth/cadastro`, `GET /auth/eu`, `POST /auth/logout`.
2. **Solo (10):** `GET /solo/campanha`, `POST /solo/campanha`,
   `GET /solo/campanhas/:id`, `DELETE /solo/campanhas/:id`, `GET /solo/missoes`,
   `GET /solo/missoes/:id`, `POST /solo/sessoes`, `GET /solo/historico`,
   `GET /solo/indicadores`, `GET /solo/estatisticas`.
3. **Turmas, do professor (12):** `GET /turmas`, `GET /turmas?ativa=false`,
   `POST /turmas`, `GET /turmas/:id`, `PATCH /turmas/:id` (renomear, trocar capa,
   arquivar, desarquivar), `POST /turmas/:id/codigo/novo`,
   `GET /turmas/:id/atribuicoes`, `POST /turmas/:id/atribuicoes`,
   `DELETE /turmas/:id/atribuicoes/:exercicioId`.
4. **Alunos, do professor (5):** `GET /turmas/:id/alunos`,
   `POST /turmas/:id/alunos/importar`, `DELETE /turmas/:id/alunos/:alunoId`,
   `POST /turmas/:id/alunos/:alunoId/zerar-senha`,
   `GET /turmas/:id/alunos/:alunoId/desempenho`.
5. **Relatórios, do professor (4):** `GET /turmas/:id/relatorio`,
   `GET /turmas/:id/relatorio/alunos`, `GET /turmas/:id/relatorio/exercicios`,
   `GET /turmas/:id/alunos/:alunoId/sessoes`.
6. **Biblioteca de exercícios, do professor (5):** `GET /exercicios`,
   `GET /exercicios/:id?turma=:turmaId`, `POST /exercicios`, `PATCH /exercicios/:id`,
   `DELETE /exercicios/:id`.
7. **Sessões (2):** `POST /sessoes`, `GET /sessoes/:id`.
8. **Aluno (6):** `GET /aluno/historico`, `GET /aluno/resumo`, `GET /aluno/salas`,
   `GET /aluno/salas/:turmaId`, `GET /turmas/:turmaId/meu-desempenho`,
   `GET /turmas/:turmaId/ranking`.
9. **Administração (6):** `GET /categorias`, `POST /categorias`,
   `PATCH /categorias/:id`, `DELETE /categorias/:id`, `GET /parametros`,
   `PUT /parametros`.

### Divergências entre o contrato e o guia do professor

O guia lista as rotas mínimas do MVP. O contrato cobre todas, mas algumas
com outro caminho ou outro corpo. As rotas iguais nos dois lados
(`GET /turmas`, `GET /turmas/:id/alunos`, `POST /exercicios`) ficam de fora.

10. **Prefixo `/api`.** O guia usa `/auth/...` sem prefixo e `/api/...` no
    resto. No back, tudo fica sob `/api`, inclusive o login
    (`POST /api/auth/login`).
    **Correção:** citar sempre o caminho com `/api` na documentação entregue.

11. **`POST /auth/google`** (guia) não existe no contrato: o login por Google
    saiu do fluxo em 15/09. Professor e usuário individual entram por e-mail
    e senha (`POST /auth/login` e `POST /auth/cadastro`).
    **Correção:** registrar a remoção na documentação. O comentário do back que
    ainda diz "SenhaHash NULL é conta que só entra pelo Google"
    (`back/src/autenticacao/autenticacao.service.ts`) deve ser atualizado.

12. **`POST /auth/aluno` com ID e senha** (guia) é, no contrato,
    `POST /auth/login` com `{ codigo, nome, senha }`. O aluno não tem ID para
    digitar: ele entra com o código da turma e o próprio nome, e cria a senha
    no primeiro acesso.
    **Correção:** documentar que uma rota só autentica as duas tabelas, e que
    a presença de `codigo` no corpo diz que é aluno.

13. **`POST /api/turmas` com Ano, Semestre e Status** (guia). O contrato
    recebia só `{ nome }`, e `ClassesProf.Ano` e `Semestre` ficavam NULL.
    **Correção (decidida, já no contrato):** `POST /turmas` aceita `ano` e
    `semestre`, os dois opcionais, e grava em `ClassesProf.Ano` e `Semestre`.
    O back monta `periodo` a partir deles. Ano que não é inteiro, ou semestre
    diferente de 1 e 2, responde 400 DADOS_INVALIDOS. Status continua fora do
    corpo: a turma nasce ativa e é arquivada depois, por `PATCH /turmas/:id`.
    Falta implementar a rota.

14. **`POST /api/alunos`, cadastro de um aluno** (guia), não existe no
    contrato. O aluno só entra pela importação, sempre dentro de uma turma.
    **Correção:** documentar que o cadastro de um aluno é
    `POST /turmas/:id/alunos/importar` com uma lista de um nome
    (`{ "nomes": ["Ana Pires"] }`).

15. **`POST /api/alunos/importar` recebendo o arquivo .CSV/.TXT** (guia) é, no
    contrato, `POST /turmas/:id/alunos/importar` recebendo JSON
    `{ nomes: [...] }`. A tela lê o arquivo e manda só os nomes. A turma vai
    no caminho porque todo aluno pertence a uma.
    **Correção:** documentar a troca de arquivo por JSON. Se o arquivo
    precisar chegar ao back, aceitar `multipart/form-data` na mesma rota.

16. **`GET /api/exercicios` com filtros** (guia). No contrato a lista é
    paginada, mas não aceita filtro.
    **Correção:** aceitar filtros opcionais em query string (por exemplo
    `?dificuldade=facil`), como `GET /solo/missoes` já aceita.

17. **`POST /api/sessoes` com `usuario_id` no corpo** (guia). No contrato, o
    aluno sai do token, nunca do corpo: aceitar `usuario_id` deixaria um aluno
    gravar sessão em nome de outro.
    **Correção (decidida, já no contrato):** tirar `usuario_id` do payload. Se
    ele vier, o back recusa a requisição com 400 DADOS_INVALIDOS, em vez de
    ignorar o campo. Ignorar em silêncio faria quem o mandou achar que
    escolheu o aluno, e a sessão seria gravada no dono do token. Falta
    implementar a rota.

18. **`POST /api/sessoes`, os outros campos do corpo.**
    - **Divergência consciente, sem correção:** o guia manda
      `tempo_segundos`; o contrato manda `tempo_gasto_segundos`. O nome vem da
      coluna `Tempo_Gasto_Segundos` do banco, e usar o mesmo nome no banco, no
      back e no front evita tradução entre as camadas.
    - O contrato manda também `turma_id` e `concluida`, que o guia não tem
      (`concluida` diz se o aluno terminou dentro do tempo limite). Os ids do
      guia são números (`"exercicio_id": 12`); no banco são texto
      (`"ex-prof-7"`).
      **Correção:** documentar os ids como texto e os dois campos a mais.

19. **`GET /api/sessoes/aluno/{id}`** (guia) é, no contrato, dividida por quem
    pede. O professor usa `GET /turmas/:id/alunos/:alunoId/sessoes` (histórico)
    e `GET /turmas/:id/alunos/:alunoId/desempenho` (estatísticas). O aluno usa
    `GET /aluno/historico` e `GET /aluno/resumo`, que saem do token, sem id.
    **Correção:** documentar a equivalência. A turma no caminho permite
    conferir que o aluno é de uma turma do professor que pede.

20. **`GET /api/relatorios/turma/{id}`** (guia) é, no contrato,
    `GET /turmas/:id/relatorio`, com o detalhe em `/relatorio/alunos` e
    `/relatorio/exercicios`.
    **Correção:** documentar a equivalência de caminho.

### Banco

21. **Papel de administrador.** `POST`, `PATCH` e `DELETE /categorias` e
    `PUT /parametros` exigem administrador, mas a tabela `Users` não tem
    coluna de papel.
    **Correção:** criar uma coluna de papel em `Users` (ou uma tabela de
    administradores) no `DB_Teclar_v8.sql`, refazer o `prisma db pull` e
    marcar um administrador no seed.

22. **Seed sem aluno em turma arquivada.** O teste de turma arquivada
    precisou arquivar a turma-1 temporariamente.
    **Correção:** pôr um aluno na turma-8 (já arquivada) no seed.
