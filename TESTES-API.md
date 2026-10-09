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

As linhas de `POST /auth/cadastro`, `GET /auth/eu` e `POST /auth/logout`
foram rodadas em 09/10/2026, do mesmo jeito (HTTP, sem navegador), pelo
script `back/test/testar-auth.mjs` (`npm run test:auth` em `back/`, com o
back no ar e o seed aplicado). Os tokens "assinatura errada", "vencido" e
"conta inexistente" são forjados pelo script com o `JWT_SEGREDO` do
`back/.env`. Cada execução cria uma conta `teste-<horário>@teclar.dev`,
apagada depois do teste.

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
| POST /auth/cadastro | Nome, e-mail e senha válidos, com nome "  Teste  Silva " e e-mail em maiúscula com espaço nas pontas | 200, token, `usuario` no formato do login, nome e e-mail normalizados, sem `campanhaAtiva` | 200, token, `tipo: "conta"`, nome "Teste Silva", e-mail minúsculo e aparado, sem `campanhaAtiva` | Conforme |
| POST /auth/cadastro | Login com a conta recém-criada | 200: a senha foi gravada como enviada | 200, token | Conforme |
| POST /auth/cadastro | E-mail que já tem conta | 409 EMAIL_EM_USO | 409 EMAIL_EM_USO, "Este e-mail já tem conta." | Conforme |
| POST /auth/cadastro | Senha " abc12345" (espaço no começo) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "A senha não pode começar nem terminar com espaço." | Conforme |
| POST /auth/cadastro | Senha "abc12345 " (espaço no fim) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "A senha não pode começar nem terminar com espaço." | Conforme |
| POST /auth/cadastro | Senha "abc123" (6 caracteres) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "A senha precisa de pelo menos 8 caracteres." | Conforme |
| POST /auth/cadastro | Senha "abcdefgh" (sem número) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "A senha precisa ter pelo menos uma letra e um número." | Conforme |
| POST /auth/cadastro | Senha "12345678" (sem letra) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "A senha precisa ter pelo menos uma letra e um número." | Conforme |
| POST /auth/cadastro | Senha vazia | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "Informe uma senha." | Conforme |
| POST /auth/cadastro | E-mail sem formato ("sem-arroba") | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "Digite um e-mail válido." | Conforme |
| POST /auth/cadastro | Nome de 1 caractere ("X") | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS, "O nome precisa de pelo menos 2 caracteres." | Conforme |
| GET /auth/eu | Sem o cabeçalho Authorization | 401 TOKEN_INVALIDO | 401 TOKEN_INVALIDO, "Token inválido ou expirado." | Conforme |
| GET /auth/eu | Token que não é JWT ("lixo.que.nao-e-jwt") | 401 TOKEN_INVALIDO | 401 TOKEN_INVALIDO | Conforme |
| GET /auth/eu | JWT assinado com outro segredo | 401 TOKEN_INVALIDO | 401 TOKEN_INVALIDO | Conforme |
| GET /auth/eu | JWT certo, vencido há 1 minuto | 401 TOKEN_INVALIDO | 401 TOKEN_INVALIDO | Conforme |
| GET /auth/eu | JWT certo e no prazo, de uma conta que não existe | 401 TOKEN_INVALIDO: sem dono, não há sessão | 401 TOKEN_INVALIDO | Conforme |
| GET /auth/eu | Token devolvido pelo cadastro | 200, a conta recém-criada | 200, mesmo id e e-mail do cadastro | Conforme |
| GET /auth/eu | Token de conta (login de `prof@teclar.dev`) | 200, idêntico ao `usuario` do login | 200, `{ id: "u-2", nome: "Henrique Lima", email, tipo: "conta", campanhaAtiva: "camp-2" }`, igual ao do login | Conforme |
| GET /auth/eu | Token de aluno (login de "Ana Pires", `K7M2QX`) | 200, idêntico ao `usuario` do login | 200, `{ id: "al-43-t1", nome: "Ana Pires", tipo: "aluno", turmas: [{ id: "turma-1", nome: "9º Ano A — Manhã" }] }`, igual ao do login | Conforme |
| POST /auth/logout | Sem token | 204 sem corpo: a rota é pública | 204, corpo vazio | Conforme |
| POST /auth/logout | Com token de conta | 204 sem corpo | 204, corpo vazio | Conforme |
| As 53 chamadas não implementadas (49 operações HTTP) | Chamar cada uma delas, uma requisição por operação | 404: estão documentadas no Swagger como "(ainda não implementada)" | 404 nas 49 operações | Conforme |

As 53 chamadas cabem em 49 operações porque `PATCH /turmas/:id` serve a
quatro chamadas (renomear, trocar capa, arquivar, desarquivar) e
`GET /turmas` serve a duas (ativas e arquivadas).

## 2. Lista de pendências

### Rotas não implementadas (50)

O grupo Autenticação está implementado inteiro (login, cadastro, eu,
logout). Faltam, por módulo:

1. **Solo (10):** `GET /solo/campanha`, `POST /solo/campanha`,
   `GET /solo/campanhas/:id`, `DELETE /solo/campanhas/:id`, `GET /solo/missoes`,
   `GET /solo/missoes/:id`, `POST /solo/sessoes`, `GET /solo/historico`,
   `GET /solo/indicadores`, `GET /solo/estatisticas`.
2. **Turmas, do professor (12):** `GET /turmas`, `GET /turmas?ativa=false`,
   `POST /turmas`, `GET /turmas/:id`, `PATCH /turmas/:id` (renomear, trocar capa,
   arquivar, desarquivar), `POST /turmas/:id/codigo/novo`,
   `GET /turmas/:id/atribuicoes`, `POST /turmas/:id/atribuicoes`,
   `DELETE /turmas/:id/atribuicoes/:exercicioId`.
3. **Alunos, do professor (5):** `GET /turmas/:id/alunos`,
   `POST /turmas/:id/alunos/importar`, `DELETE /turmas/:id/alunos/:alunoId`,
   `POST /turmas/:id/alunos/:alunoId/zerar-senha`,
   `GET /turmas/:id/alunos/:alunoId/desempenho`.
4. **Relatórios, do professor (4):** `GET /turmas/:id/relatorio`,
   `GET /turmas/:id/relatorio/alunos`, `GET /turmas/:id/relatorio/exercicios`,
   `GET /turmas/:id/alunos/:alunoId/sessoes`.
5. **Biblioteca de exercícios, do professor (5):** `GET /exercicios`,
   `GET /exercicios/:id?turma=:turmaId`, `POST /exercicios`, `PATCH /exercicios/:id`,
   `DELETE /exercicios/:id`.
6. **Sessões (2):** `POST /sessoes`, `GET /sessoes/:id`.
7. **Aluno (6):** `GET /aluno/historico`, `GET /aluno/resumo`, `GET /aluno/salas`,
   `GET /aluno/salas/:turmaId`, `GET /turmas/:turmaId/meu-desempenho`,
   `GET /turmas/:turmaId/ranking`.
8. **Administração (6):** `GET /categorias`, `POST /categorias`,
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
