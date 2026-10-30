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

As linhas de `GET /turmas`, `POST /turmas`, `PATCH /turmas/:id` e
`POST /turmas/:id/codigo/novo` foram rodadas em 10/10/2026, do mesmo jeito,
pelo script `back/test/testar-turmas.mjs` (`npm run test:turmas` em
`back/`, com o back no ar e o seed aplicado). O script só arquiva e troca o
código das turmas que ele mesmo cria; cada execução cria três turmas
"Teste <horário>" na conta `prof@teclar.dev`, apagadas pelo seed.

As linhas das atribuições (`/turmas/:id/atribuicoes`), dos alunos da turma
(`/turmas/:id/alunos...`) e da biblioteca (`/exercicios...`) foram rodadas
em 10/10/2026, do mesmo jeito, pelos scripts `back/test/testar-atribuicoes.mjs`,
`testar-alunos.mjs` e `testar-exercicios.mjs` (`npm run test:atribuicoes`,
`test:alunos` e `test:exercicios` em `back/`, com o back no ar e o seed
aplicado). Os scripts só leem as turmas, os alunos e os exercícios do seed:
importam, zeram, removem, atribuem e arquivam só o que eles mesmos criam.
Como ainda não existe rota de sessão do mundo Escola, eles gravam sessões
direto no banco (pelo `BancoService` do `dist/`) e leem o banco para
conferir o CASCADE do remover aluno e que arquivar exercício mantém as
sessões. O seed apaga tudo o que eles criam.

As linhas de `POST /sessoes`, `GET /sessoes/:id`, dos relatórios
(`/turmas/:id/relatorio...` e `/turmas/:id/alunos/:alunoId/sessoes`) e do
ranking (`/turmas/:id/ranking`) foram rodadas em 10/10/2026, do mesmo
jeito, pelos scripts `back/test/testar-sessoes.mjs`, `testar-relatorios.mjs`
e `testar-ranking.mjs` (`npm run test:sessoes`, `test:relatorios` e
`test:ranking` em `back/`, com o back no ar e o seed aplicado). Cada script
cria a própria turma, os próprios exercícios e os próprios alunos (que
fazem o primeiro acesso para ter token). O de sessões grava pela rota; os
de relatórios e ranking gravam sessões direto no banco, com datas no
passado, porque a rota só grava com a data de agora e a janela de 7 dias e
os dias seguidos precisam de dias anteriores. O seed não tem sessão do
Solo: o teste de sessões grava uma em cada campanha, direto no banco.

As linhas de `GET /turmas/:id`, do Solo (`/solo/...`), do próprio aluno
(`/aluno/...` e `/turmas/:id/meu-desempenho`) e da administração
(`/categorias...` e `/parametros`) foram rodadas em 13/10/2026, do mesmo
jeito, pelos scripts `back/test/testar-turmas.mjs` (que ganhou a parte do
detalhe), `testar-solo.mjs`, `testar-aluno.mjs` e `testar-administracao.mjs`
(`npm run test:turmas`, `test:solo`, `test:aluno` e `test:administracao` em
`back/`, com o back no ar e o seed aplicado), já com o banco v9
(`Users.Administrador` e `xp_por_nivel` 200). O do Solo cria a própria
conta pelo `POST /auth/cadastro` (o único jeito de ter "ainda não começou o
Solo" sem mexer nas do seed), joga pelas rotas, uma sessão logo depois
da outra (desde 29/10/2026 `Data_Sessao` guarda milissegundos, ver o item
25 da seção 2), e apaga a conta no fim. O do aluno grava as sessões direto no banco, com
datas no passado, pelos dias seguidos. O de administração usa
`ana@teclar.dev` (a administradora do seed) e, como o seed não toca em
Categorias nem em Configuracoes, apaga as categorias que criou e devolve
os parâmetros aos valores do começo.

As linhas do limite de senhas erradas, do limite geral, do helmet e do
`JWT_SEGREDO` foram rodadas em 29/10/2026, do mesmo jeito, pelo fim do
`back/test/testar-auth.mjs` (`npm run test:auth`). O caso do 429 bloqueia
por 1 minuto só identidades que nenhum outro script usa (a conta que o
próprio script cria e o Caio Ferreira da turma-1); rodar o script duas
vezes no mesmo minuto falha no Caio. O caso do `JWT_SEGREDO` sobe um
segundo back (`node dist/main.js`) com a variável vazia e confere a
mensagem de erro e o código de saída. A linha das 22h de `GET /aluno/resumo`
é do `testar-aluno.mjs`, que desde então grava as sessões em hora fixa de
Brasília (12h, ou 9h e 22h onde o caso pede), e não mais "agora menos N
dias".

Em 29/10/2026, das 22h33 às 22h36 (horário de Brasília), com o back
reiniciado e o `npm run seed` aplicado, os onze scripts rodaram uma vez
cada, em comandos separados e sem espera entre eles, todos sem falha. O
horário importa: é a janela (21h às 23h59) em que a conta dos dias
seguidos em UTC errava (ver "Defeitos que os testes pegaram", na seção 2).

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
| POST /auth/login | 5 senhas erradas para a conta criada pelo script, do mesmo IP | 401 CREDENCIAIS nas 5 | 401 CREDENCIAIS nas 5 | Conforme |
| POST /auth/login | 6ª tentativa, com a senha CERTA e o e-mail em maiúscula com espaço | 429 MUITAS_TENTATIVAS: a pessoa está bloqueada, e o e-mail é a mesma pessoa | 429, "Muitas tentativas. Espere um minuto e tente de novo." | Conforme |
| POST /auth/login | Logo depois, `prof@teclar.dev` (senha certa), do mesmo IP | 200: o bloqueio é da pessoa, não do IP | 200 | Conforme |
| POST /auth/login | 5 senhas erradas do aluno Caio Ferreira (`K7M2QX`); a 6ª como "caio  ferreira"/`k7m2qx` com a senha certa | 401 nas 5; 429 na 6ª (mesmo aluno escrito de outro jeito) | Como esperado | Conforme |
| POST /auth/login | Logo depois, a colega Marina Duarte Alves, mesma turma, mesmo IP | 200: a turma inteira sai pelo mesmo IP da escola | 200 | Conforme |
| POST /auth/login | `leo@teclar.dev`: 4 erradas, a certa, mais 4 erradas, a certa | Todas as certas 200: login certo zera a contagem (sem zerar seriam 8 falhas) | 401 nas erradas, 200 nas duas certas | Conforme |
| POST /auth/login | 10 logins certos seguidos em `prof@teclar.dev` | 200 nos 10: login certo não gasta tentativa | 200 nos 10 | Conforme |
| POST /auth/logout | Depois dos bloqueios | 204; as outras rotas ficam no limite geral de 1000/min por IP | 204, `X-RateLimit-Limit: 1000` | Conforme |
| (todas) | Cabeçalhos do helmet numa resposta da API | `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, sem `X-Powered-By`, CSP sem `upgrade-insecure-requests` (o back é HTTP) | Como esperado | Conforme |
| GET /api/docs | Swagger com o CSP do helmet | 200; página sem `<script>` inline; `swagger-ui.css`, `swagger-ui-bundle.js`, `swagger-ui-standalone-preset.js` e `swagger-ui-init.js` 200 (o CSP só libera script do próprio back) | 200 nos cinco, nenhum script inline | Conforme |
| (subida) | `node dist/main.js` com `JWT_SEGREDO` vazio | O back não sobe: erro na montagem do AutenticacaoModule | Saída 1, "JWT_SEGREDO não definido no .env. Veja o .env.example." | Conforme |
| GET /turmas, POST /turmas, PATCH /turmas/:id, POST /turmas/:id/codigo/novo | Sem o cabeçalho Authorization | 401 TOKEN_INVALIDO | 401 TOKEN_INVALIDO nas quatro | Conforme |
| GET /turmas, POST /turmas, PATCH /turmas/:id, POST /turmas/:id/codigo/novo | Token de aluno ("Ana Pires", `K7M2QX`) | 403 TIPO_INVALIDO | 403 TIPO_INVALIDO nas quatro | Conforme |
| GET /turmas | Token de `prof@teclar.dev` (u-2) | 200, só as turmas ativas de u-2, com as contagens feitas no back | 200, todas de u-2 e ativas; sem a turma-5 (de u-1) nem a turma-8 (arquivada); turma-1 com `codigo` K7M2QX, 4 alunos, 8 exercícios, `periodo` "2026 · 1º semestre", `capaSemente` 7001, `dataCriacao` "2026-02-01" | Conforme |
| GET /turmas | Turma sem ano, semestre e capa (turma-7) | Sem `periodo` e sem `capaSemente` | Os dois campos ausentes | Conforme |
| GET /turmas?ativa=false | Token de u-2 | 200, só as arquivadas de u-2 | 200, todas com `ativa: false`; traz a turma-8 | Conforme |
| POST /turmas | `professorId` no corpo, de outra conta (`"u-1"`) e da própria (`"u-2"`) | 400 DADOS_INVALIDOS: recusado, nunca ignorado (como o `usuario_id` de POST /sessoes) | 400 DADOS_INVALIDOS nos dois; nenhuma turma criada | Conforme |
| POST /turmas | Nome com espaços sobrando, `ano: 2026`, `semestre: 1` | 200 na forma de um item de GET /turmas; nome normalizado; `professorId` do token | 200, nome aparado, `professorId` u-2, código de 6 caracteres sem I, O, 0 e 1, `capaSemente` sorteada, `periodo` "2026 · 1º semestre", 0 alunos e 0 exercícios, `ativa: true`; o item em GET /turmas é idêntico à resposta | Conforme |
| POST /turmas | Só o nome | 200 sem `periodo` | 200 sem `periodo` | Conforme |
| POST /turmas | Nome de uma turma ativa da conta, em maiúscula | 409 TURMA_DUPLICADA | 409 TURMA_DUPLICADA | Conforme |
| POST /turmas | Nome de uma turma ARQUIVADA da conta | 200: o nome só é único entre ativas (a regra de Categorias) | 200, turma nova com o mesmo nome | Conforme |
| PATCH /turmas/:id (desarquivar) | Turma arquivada cujo nome já foi usado por uma ativa | 409 TURMA_DUPLICADA: desarquivar deixaria duas ativas com o mesmo nome | 409 TURMA_DUPLICADA; depois de arquivar a outra, o mesmo PATCH deu 200 | Conforme |
| POST /turmas | Nome de 2 e de 101 caracteres, sem nome, `ano: "2026"`, `ano: 2026.5`, `semestre: 3` | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS nos seis | Conforme |
| PATCH /turmas/:id (renomear) | Nome novo; depois o mesmo nome de novo | 200 com o nome novo; renomear para o próprio nome não é conflito | 200 nos dois, código igual | Conforme |
| PATCH /turmas/:id (renomear) | Nome de outra turma ativa da conta; nome de 2 caracteres | 409 TURMA_DUPLICADA; 400 DADOS_INVALIDOS | 409 TURMA_DUPLICADA; 400 DADOS_INVALIDOS | Conforme |
| PATCH /turmas/:id (trocarCapa) | `capaSemente: 418207`; depois `"abc"` | 200 com a semente nova; 400 DADOS_INVALIDOS | 200 com 418207; 400 DADOS_INVALIDOS | Conforme |
| PATCH /turmas/:id | Nome válido junto com `capaSemente: 1.5` | 400 e nenhum campo muda | 400 DADOS_INVALIDOS; o nome continuou o anterior | Conforme |
| PATCH /turmas/:id (arquivar) | `ativa: false`; depois `ativa: "sim"` | 200, some de GET /turmas e aparece em ?ativa=false; 400 DADOS_INVALIDOS | Como esperado | Conforme |
| PATCH /turmas/:id (desarquivar) | `ativa: true` | 200, volta a GET /turmas | 200, volta a GET /turmas | Conforme |
| POST /turmas/:id/codigo/novo | Turma criada pelo teste | 200 com outro código na mesma regra | 200, código novo diferente do antigo, já visto em GET /turmas | Conforme |
| PATCH /turmas/:id e POST /turmas/:id/codigo/novo | turma-5 (de u-1) e um id que não existe, com token de u-2 | 404 NAO_ENCONTRADO nos dois casos | 404 NAO_ENCONTRADO nos quatro; a turma-5 continuou intacta para u-1 | Conforme |
| GET, POST e DELETE de /turmas/:id/atribuicoes | Sem token; token de aluno ("Ana Pires", `K7M2QX`) | 401 TOKEN_INVALIDO; 403 TIPO_INVALIDO | 401 e 403 nas três | Conforme |
| GET /turmas/:id/atribuicoes | turma-1 do seed | 200, as 8 atribuições na ordem de atribuição, com título, data, `concluidoPor` e `totalAlunos` do back | 200, 8 itens, a primeira `ex-prof-1` em "2026-02-03", `totalAlunos` 4 em todas | Conforme |
| GET /turmas/:id/atribuicoes | Turma de teste com 2 alunos: Lia concluiu o exercício A duas vezes, Rui estourou o tempo nele | `totalAlunos` 2; `concluidoPor` 1 no A (alunos distintos, só concluídas) e 0 no B | Como esperado | Conforme |
| POST /turmas/:id/atribuicoes | `[A, B, A]` numa turma vazia | 200, a lista crua com 2 itens, `prazo: null` | 200, 2 itens, datas "AAAA-MM-DD", `prazo: null` | Conforme |
| POST /turmas/:id/atribuicoes | Repetir `[A]` | Não duplica nem muda a data da primeira vez | 200, 2 itens, mesma data | Conforme |
| POST /turmas/:id/atribuicoes | `[C, "ex-prof-6"]` (de u-1) e `[C, "nao-existe"]` | 404 NAO_ENCONTRADO, e nem o C é gravado | 404 nos dois; a turma continuou com 2 atribuições | Conforme |
| POST /turmas/:id/atribuicoes | Lista vazia, `exercicioIds` que não é lista, sem `exercicioIds`, id numérico, `professorId` no corpo | 400 DADOS_INVALIDOS | 400 nos cinco | Conforme |
| DELETE /turmas/:id/atribuicoes/:exercicioId | Tirar o A da turma | 204; some da lista; as 3 sessões no A ficam; o A continua na biblioteca | Como esperado | Conforme |
| DELETE /turmas/:id/atribuicoes/:exercicioId | O A de novo; o C, nunca atribuído | 404 NAO_ENCONTRADO | 404 nos dois | Conforme |
| GET, POST e DELETE de /turmas/:id/atribuicoes | turma-5 (de u-1) e turma que não existe, com token de u-2 | 404 NAO_ENCONTRADO | 404 nos quatro casos; a turma-5 continuou só com o `ex-prof-6` | Conforme |
| As cinco rotas de /turmas/:id/alunos | Sem token; token de aluno | 401 TOKEN_INVALIDO; 403 TIPO_INVALIDO | 401 e 403 nas cinco | Conforme |
| POST /turmas/:id/alunos/importar | `["Ana Pires", "  Bruno   Sato ", "ana  pires", "ÁNA PÍRES", "", "X", 123, "Carla Nunes"]` numa turma vazia | 3 adicionados, normalizados, sem senha e com agregados null; repetidos na lista (sem maiúscula nem acento), vazio, curto e não-texto em falhas | 3 adicionados (Ana Pires, Bruno Sato, Carla Nunes), `SenhaHash` NULL no banco; 5 falhas com o motivo de cada uma | Conforme |
| POST /turmas/:id/alunos/importar | `["ANA PIRES", "brúno sato", "Débora Lima"]` na mesma turma | Os dois primeiros em `jaEstavam`, na forma gravada; só Débora adicionada | `jaEstavam: ["Ana Pires", "Bruno Sato"]`, 1 adicionado | Conforme |
| POST /turmas/:id/alunos/importar | `nomes` que não é lista; 501 nomes; `professorId` no corpo | 400 DADOS_INVALIDOS, nada gravado | 400 nos três; a turma continuou com 4 alunos | Conforme |
| GET /turmas/:id/alunos | Turma de teste; turma-1 do seed | Ordem alfabética, senha nunca sai; agregados prontos para quem treinou | Ordem alfabética, sem campo de senha; Ana Pires (turma-1) com `totalSessoes`, `wpmMedio` inteiro e `ultimaAtividade` | Conforme |
| GET /turmas/:id/alunos/:alunoId/desempenho | Ana Pires da turma-1; aluno que nunca treinou | `totalSessoes` = sessões da lista, `wpmMedio` = média das concluídas, igual à linha da lista; null para quem nunca treinou | Como esperado | Conforme |
| POST /turmas/:id/alunos/:alunoId/zerar-senha | Bruno fez o primeiro acesso ("bruno123"); o professor zera; Bruno faz login com "nova4567" | 204; o login seguinte é primeiro acesso, com a senha nova; a antiga deixa de valer | 204 sem corpo; login 200 com `primeiroAcesso: true`; "bruno123" deu 401 CREDENCIAIS | Conforme |
| POST /turmas/:id/alunos/:alunoId/zerar-senha | Zerar quem já está sem senha | 204 igual | 204 | Conforme |
| DELETE /turmas/:id/alunos/:alunoId | Carla, com 1 sessão gravada no banco | 204; some da lista; a sessão dela some (CASCADE); o login dela para de entrar | 204; sessões dela no banco: 0; login 401 CREDENCIAIS; de novo, 404 | Conforme |
| POST /turmas/:id/alunos/importar | Carla importada de novo depois de removida | Linha nova, com outro id | Outro id | Conforme |
| As cinco rotas de /turmas/:id/alunos | turma-5 (de u-1), turma que não existe, e `al-44` (da turma-1, mesma conta) na URL da turma de teste | 404 NAO_ENCONTRADO | 404 em todos; `al-44` e `al-43-t5` continuaram com senha | Conforme |
| GET, POST, PATCH e DELETE de /exercicios | Sem token; token de aluno | 401 TOKEN_INVALIDO; 403 TIPO_INVALIDO | 401 e 403 nas quatro; GET /exercicios/:id sem token também 401 | Conforme |
| POST /exercicios | Formulário válido com quebra de linha no texto | 200 na forma da listagem, `professorId` do token, `atribuidoA: 0`, quebra de linha virando espaço | Como esperado | Conforme |
| POST /exercicios | Título de 2 e de 101, texto de 19 e de 2001, dificuldade fora da lista, tempo 3601, -1 e "60", sem título, `professorId` no corpo | 400 DADOS_INVALIDOS (limites do front) | 400 nos dez | Conforme |
| GET /exercicios | Token de u-2 | 200 paginado com tudo (`pagina: 1`, `total` = itens), só os de u-2, com `atribuidoA` | Como esperado; sem o `ex-prof-6` (de u-1) | Conforme |
| GET /exercicios/:id | Professor: o dele, e com `?turma=` de outra conta | 200; o `?turma=` é ignorado | 200 nos dois | Conforme |
| GET /exercicios/:id | Aluno (Ana, turma-1): `ex-prof-1?turma=turma-1`; sem `?turma=`; `?turma=turma-2`; exercício não atribuído à turma dele | 200 no primeiro; 404 nos outros | Como esperado | Conforme |
| PATCH /exercicios/:id | Formulário inteiro; só o título; com `professorId` | 200 como ficou; 400; 400 | Como esperado | Conforme |
| GET, PATCH e DELETE de /exercicios/:id | `ex-prof-6` (de u-1) e id que não existe, com token de u-2 | 404 NAO_ENCONTRADO | 404 em todos; o `ex-prof-6` continuou intacto para u-1 | Conforme |
| DELETE /exercicios/:id | Exercício atribuído a 2 turmas, com 1 sessão de aluno | 204; ARQUIVA: some da biblioteca e das duas turmas; a linha fica com `Ativo = false`; a sessão e o histórico do aluno ficam | 204 sem corpo; GET /exercicios e as atribuições das duas turmas sem ele; no banco, `Ativo = false`, 0 atribuições, sessão presente; o desempenho do aluno ainda mostra a sessão | Conforme |
| GET, PATCH, DELETE de /exercicios/:id e POST /turmas/:id/atribuicoes | O exercício arquivado | 404 NAO_ENCONTRADO: arquivado é como inexistente | 404 nos quatro | Conforme |
| POST /sessoes e GET /sessoes/:id | Sem token | 401 TOKEN_INVALIDO | 401 nas duas | Conforme |
| POST /sessoes | Token de conta (`prof@teclar.dev`) | 403 TIPO_INVALIDO | 403 TIPO_INVALIDO | Conforme |
| POST /sessoes | `usuario_id`, `alunoId` ou `professorId` no corpo; sem `exercicio_id`; sem `turma_id`; `wpm` -1, 1000 e "30"; `precisao` 100,5; `acertos` 1,5; `erros` -1; `tempo_gasto_segundos` "58"; `concluida` "sim" | 400 DADOS_INVALIDOS | 400 nos treze casos | Conforme |
| POST /sessoes | `turma_id` de outra turma da conta e de turma do seed; exercício da conta não atribuído; exercício de outro professor; exercício que não existe | 404 NAO_ENCONTRADO, nada gravado | 404 nos cinco; 0 sessões do aluno no banco | Conforme |
| POST /sessoes | Corpo válido, primeira sessão do aluno no exercício | 200; `alunoId` do token, `turmaId` da turma dele, medidas como chegaram; `recordePessoal: true` | Como esperado (`precisao` 94,5 voltou 94,5) | Conforme |
| POST /sessoes | PPM 25, depois 30,5, depois 30,5 de novo | `recordePessoal` false, true, false | Como esperado | Conforme |
| POST /sessoes | Sessão com `concluida: false` | 200, gravada | 200 | Conforme |
| POST /sessoes | GET /turmas/:id/alunos depois das 5 sessões | Agregados contam as sessões: 5 sessões, média das 4 concluídas | `totalSessoes` 5, `wpmMedio` 29 | Conforme |
| POST /sessoes | Primeira sessão de OUTRO aluno no mesmo exercício | O recorde é por aluno: `true` | `true` | Conforme |
| POST /sessoes | Exercício arquivado depois de ter sessões | 404 para sessão nova; as antigas continuam no histórico do professor e o dono ainda as relê | 404; histórico com as 5; GET /sessoes/:id 200 | Conforme |
| POST /sessoes | Turma do aluno arquivada depois do login (token ainda no prazo) | 401 TOKEN_INVALIDO, como no GET /auth/eu | 401 TOKEN_INVALIDO | Conforme |
| GET /sessoes/:id | O dono lê a sessão que gravou | 200, igual à resposta do POST sem o `recordePessoal` | Igual | Conforme |
| GET /sessoes/:id | Sessão de outro aluno (nos dois sentidos); sessão da Escola com token de conta (até a do professor da turma); id que não existe | 404 NAO_ENCONTRADO | 404 em todos | Conforme |
| GET /sessoes/:id | Conta lê a sessão do Solo da própria campanha; outra conta tenta ler a mesma; aluno tenta ler uma do Solo | 200 com `xpGanho` e sem `alunoId`; 404; 404 | Como esperado | Conforme |
| As quatro rotas de relatório | Sem token; token de aluno | 401 TOKEN_INVALIDO; 403 TIPO_INVALIDO | 401 e 403 nas quatro | Conforme |
| GET /turmas/:id/relatorio | Turma de teste com 3 alunos: Ana com 5 sessões (2 concluídas hoje no ex1, 1 não concluída há 10 dias, 1 concluída num exercício tirado da turma e 1 num arquivado, as duas há 20 dias); Beto com 1 não concluída há 10 dias; Caio sem sessão | `totalAlunos` 3, `alunosComSessao` 2, `alunosAtivos` 1 (janela de 7 dias), médias das SESSÕES concluídas 35 / 85, `exerciciosConcluidos` 3 (pares, contando o tirado e o arquivado) | Como esperado | Conforme |
| GET /turmas/:id/relatorio/alunos | A mesma turma | Uma linha por aluno; Ana 5 sessões, 35 / 85, 3 concluídos; `exerciciosAtribuidos` 2 em todas; Beto médias null e 0 concluídos; Caio 0 sessões e `ultimaAtividade` null; a linha é a de GET /turmas/:id/alunos mais as duas contagens | Como esperado | Conforme |
| GET /turmas/:id/relatorio/exercicios | A mesma turma | Só ex1 e ex2 (os atribuídos agora); ex1: `concluidoPor` 1 de 3, médias 45 / 95, `estouraramTempo` 1 (tem limite); ex2: sem limite, `estouraramTempo` 0 mesmo com sessão não concluída, médias null | Como esperado | Conforme |
| GET /turmas/:id/alunos/:alunoId/sessoes | Ana; Caio | Paginado com as 5, `pagina` 1, da mais recente para a mais antiga, título também do exercício arquivado e do tirado da turma; Caio lista vazia | Como esperado | Conforme |
| As quatro rotas de relatório | turma-5 (de u-1), turma que não existe, e `al-44` (da turma-1, mesma conta) na URL da turma de teste | 404 NAO_ENCONTRADO, e não lista vazia | 404 em todos | Conforme |
| GET /turmas/:id/relatorio | turma-1 do seed (só leitura) | 200 | 200, `totalAlunos` 4 | Conforme |
| GET /turmas/:id/ranking | Sem token; token de conta (a do professor da turma); aluno pedindo turma que não é a dele, turma que não existe, e aluno do seed pedindo a turma de teste | 401; 403 TIPO_INVALIDO; 404 NAO_ENCONTRADO | Como esperado | Conforme |
| GET /turmas/:id/ranking | Turma de teste com 6 alunos e sessões em dias escolhidos | Pontos = lições×20 + ritmo + dias×5, na ordem pontos > lições > dias: Rita 115, Sara 100, Xavier 52, Tito 52 (empata com Xavier e fica atrás por ter menos lições), Ugo 5 (1 dia, sessão não concluída), Vera 0 | Como esperado | Conforme |
| GET /turmas/:id/ranking | Visto pela Vera (6ª), pelo Ugo (5º) e pela Rita (1ª) | Nome só no pódio e na própria linha; null nos outros; só uma linha `voce`; o nome dos anônimos nem aparece no TEXTO da resposta | Como esperado; "Tito" e "Ugo" não aparecem no texto da resposta da Vera | Conforme |
| GET /turmas/:id/ranking | Exercício arquivado depois das sessões | A lição continua contando | Rita com 3 lições e 115 | Conforme |
| GET /turmas/:id/ranking | Sara desativada (`Alunos.Ativo = false`, direto no banco) | Sai do ranking | 5 linhas, sem "Sara" no texto | Conforme |
| GET /turmas/:id | Sem token; token de aluno; turma-5 (de u-1) e turma que não existe, com token de u-2 | 401; 403 TIPO_INVALIDO; 404 NAO_ENCONTRADO | Como esperado | Conforme |
| GET /turmas/:id | Turma recém-criada, sem sessão | 200 com `ppmMedio: null`, nunca 0 | `ppmMedio: null` | Conforme |
| GET /turmas/:id | Turma com 4 alunos: Lia concluiu duas (30 e 41 PPM, média 36), Rui uma (33), Caio só uma NÃO concluída (90), Bia nenhuma | `ppmMedio` 34.5: média, com 1 casa, dos alunos que concluíram; o resto igual ao item de GET /turmas | `ppmMedio` 34.5; o resto idêntico ao item da lista, com 4 alunos e 1 exercício | Conforme |
| GET /turmas/:id | Turma arquivada da conta | 200 com `ativa: false` (só não existe ou de outra conta é 404) | 200, `ativa: false` | Conforme |
| As dez rotas do Solo | Sem token | 401 TOKEN_INVALIDO | 401 nas dez | Conforme |
| As rotas do Solo, menos GET /solo/missoes/:id | Token de aluno | 403 TIPO_INVALIDO | 403 nas nove | Conforme |
| GET /solo/missoes/:id | Token de aluno | 200: a lição não é de ninguém, e a rota serve qualquer token | 200, a solo-001 | Conforme |
| GET /solo/campanha | Conta recém-cadastrada, sem campanha | 200 com `null` (estado de primeira vez, não erro) | 200, `null` | Conforme |
| GET /solo/missoes, /historico, /indicadores, /estatisticas e POST /solo/sessoes | Conta sem campanha | 404 NAO_ENCONTRADO | 404 nas cinco | Conforme |
| POST /solo/campanha | Primeira vez com 8 pedidos simultâneos; depois mais um | 200 em todos, nível 1, 0 XP, jogador do token, todos com a MESMA campanha; o UNIQUE de `CampanhasSolo.JogadorID` (banco v9) deixa uma linha só, e quem perde a corrida não recebe erro | 200 nos 9, mesmo `campanhaId`; 1 campanha da conta no banco | Conforme |
| GET /solo/campanhas/:id | O dono; outra conta (leo) pedindo a nova; a conta nova pedindo a camp-1 (de leo); id que não existe | 200; 404; 404; 404 (nunca 403) | Como esperado | Conforme |
| DELETE /solo/campanhas/:id | A camp-1 (de leo) pedida pela conta nova | 404, e nada apagado | 404; leo continua com a camp-1 | Conforme |
| GET /solo/missoes | Conta com campanha | 200, as 76 lições na ordem 1 a 76, sem o texto e sem cadeado; a primeira igual ao exemplo do contrato | 76, em ordem; solo-001 com 472 s e 59 caracteres, 8 campos | Conforme |
| GET /solo/missoes/:id | solo-001; id que não existe | 200 com o texto, `tamanhoCaracteres` = tamanho do texto; 404 | Como esperado | Conforme |
| POST /solo/sessoes | `campanha_id`, `jogadorId`, `usuario_id`, `alunoId` ou `professorId` no corpo; sem `exercicio_id`; `wpm` -1, 1000 e "30"; `precisao` 100,5; `acertos` 1,5; `erros` -1; `tempo_gasto_segundos` "90"; `concluida` "sim" | 400 DADOS_INVALIDOS (recusado, nunca ignorado) | 400 nos catorze; XP continuou 0 e nenhuma sessão gravada | Conforme |
| POST /solo/sessoes | Lição que não existe | 404 NAO_ENCONTRADO | 404 | Conforme |
| POST /solo/sessoes | Cinco sessões: solo-001 concluída 96% 30 PPM; solo-001 100% 40; solo-002 não concluída 50% 20; solo-002 80% 25; solo-001 não concluída 40% 10 | XP 74, 75, 15, 70, 15 (base 50 + bônus da precisão; 15 sem concluir); total 74, 149, 164, 234, 249; nível 1, 1, 1, 2, 2 (200 XP por nível), `subiuDeNivel` só na 4ª; `recordePessoal` true, true, true, true, false | Exatamente esses números | Conforme |
| POST /solo/sessoes | Refazer a solo-001 pior (a 5ª sessão) | Progresso não regride: a lição continua concluída (2 lições antes e depois), a melhor marca continua 40 PPM e 100%, o XP só sobe e o nível não desce; a tentativa conta (3) | Como esperado | Conforme |
| GET /sessoes/:id | A 1ª sessão do Solo pelo dono; a mesma por outra conta | 200 com `xpGanho` 74; 404 | Como esperado | Conforme |
| GET /solo/historico | Depois das cinco | Paginado com as 5 (`pagina` 1), da mais antiga para a mais recente, `xpGanho` de cada uma somando o XP da campanha (249), sem `alunoId` | Como esperado | Conforme |
| GET /solo/indicadores | Depois das cinco | Nível 2, 249 XP, 5 sessões, médias só das 3 concluídas (32 PPM, 92%), melhor PPM 40 | Idêntico | Conforme |
| GET /solo/estatisticas | Depois das cinco | 2 lições concluídas, melhores 40 PPM e 100%, uma linha por lição tentada com título e nível do JOIN; solo-002 com 2 tentativas, 25 PPM e 80% | Como esperado | Conforme |
| DELETE /solo/campanhas/:id | O dono apaga a dele | 204 sem corpo; GET /solo/campanha volta a null; as sessões vão junto (CASCADE); começar de novo cria outra, do zero | Como esperado | Conforme |
| As cinco rotas do próprio aluno | Sem token; token de conta (até a do professor da turma) | 401; 403 TIPO_INVALIDO | 401 e 403 nas cinco | Conforme |
| GET /aluno/salas/:turmaId e GET /turmas/:turmaId/meu-desempenho | turma-1 e turma que não existe, pela Lia; a sala de teste pela Ana do seed | 404 NAO_ENCONTRADO, nunca 403 | 404 em todos | Conforme |
| GET /aluno/historico | Lia, com 4 sessões em dias diferentes | Paginado com as 4 dela, da mais recente para a mais antiga, com `turmaId`, `tituloExercicio` e `nomeTurma`; nenhuma do colega | Como esperado | Conforme |
| GET /aluno/historico | Bia, que nunca treinou | Lista vazia, `total` 0 | Como esperado | Conforme |
| GET /aluno/resumo | Lia: concluídas 40/95 e 30/90, não concluídas 50/80 e 20/70, em hoje, ontem e anteontem | 4 sessões, 2 concluídas, médias só das concluídas (35, 93), melhores de TODAS (50 PPM, 95%), 3 dias seguidos | Idêntico | Conforme |
| GET /aluno/resumo | Bia; Rui (treinou hoje e há 5 e 6 dias) | Bia: zeros e null (nunca 0); Rui: 1 dia seguido | Como esperado | Conforme |
| GET /aluno/resumo | Bia: sessões às 22h de anteontem e ao meio-dia de ontem (Brasília) | 2 dias seguidos: 22h de Brasília é do mesmo dia em Brasília (em UTC já seria o dia seguinte, e daria 1) | 2 | Conforme |
| GET /aluno/salas | Lia; Bia | Uma sala, a dela, com o nome do professor, 3 alunos e o progresso DELA (Lia 2 de 3 feitos, contando o de tempo esgotado; Bia 0 de 3) | Como esperado | Conforme |
| GET /aluno/salas/:turmaId | Lia | Cabeçalho igual ao de GET /aluno/salas; exercícios na ordem da atribuição; ex1 `feito` com a melhor CONCLUÍDA (40/95, e não os 50 da não concluída), caracteres contados no back, sem o texto, `prazo` null; ex2 `tempo_esgotado` (20/70); ex3 `nao_feito` com null | Como esperado | Conforme |
| GET /aluno/salas/:turmaId | Texto cru da resposta da Lia | Nenhum nome nem id de colega | Nem "Rui", nem "Bia", nem os ids | Conforme |
| GET /turmas/:turmaId/meu-desempenho | Lia (2 concluídas); Rui (3 concluídas); Bia | Lia: contagens e 3 dias, as duas médias null (abaixo de 3); Rui: a dele 50/90 e a da sala sobre as 5 concluídas de todos 44/91; Bia: zeros e null | Idêntico | Conforme |
| GET /aluno/salas/:turmaId e GET /aluno/historico | Exercício arquivado depois das sessões | Sai da sala (2 exercícios, 1 feito); a sessão nele continua no histórico, com o título | Como esperado | Conforme |
| GET /aluno/salas, /aluno/salas/:turmaId, /turmas/:id/meu-desempenho e /aluno/historico | Turma da Lia arquivada (token ainda no prazo) | Salas vazio; sala e meu-desempenho 404; o histórico continua com as 4 | Como esperado | Conforme |
| GET /categorias e GET /parametros | Sem token; conta comum, aluno e administradora | 401; 200 para os três, só as categorias ativas, parâmetros como números (`xpPorNivel` 200) | Como esperado | Conforme |
| POST, PATCH, DELETE /categorias e PUT /parametros | Sem token; conta comum (`prof@teclar.dev`); aluno — com corpo válido e com corpo inválido | 401; 404 NAO_ENCONTRADO para os dois, antes de qualquer 400; nada muda | 401 e 404 nos seis casos de cada; categorias e parâmetros iguais aos do começo | Conforme |
| PUT /parametros | Dar o papel à u-2 no banco, e tirar, sem novo login | Vale na hora nos dois sentidos (200, depois 404) | Como esperado | Conforme |
| POST /categorias | Nome com espaços sobrando; o mesmo em outra caixa; vazio, só espaços, sem nome, número, 51 caracteres | 200 com o nome normalizado e id numérico; 409 CATEGORIA_DUPLICADA; 400 DADOS_INVALIDOS nos cinco | Como esperado | Conforme |
| PATCH /categorias/:id | Renomear; o próprio nome em outra caixa; nome de outra ativa; vazio; id 999999 e "abc" | 200; 200; 409 CATEGORIA_DUPLICADA; 400; 404 | Como esperado | Conforme |
| DELETE /categorias/:id | Categoria de um exercício ativo; depois de arquivar o exercício; de novo; PATCH da apagada; POST com o nome da apagada | 409 CATEGORIA_EM_USO; 204, some da lista e fica no banco com `Ativo = false`; 404; 404; 200 (nome só é único entre as ativas) | Como esperado | Conforme |
| PUT /parametros | `{ wpmMeta: 45 }`; depois três campos | Só o enviado muda; GET já mostra | Como esperado | Conforme |
| PUT /parametros | `wpmMeta` 0, 1000, "45" e 45,5; `precisaoMinima` 101; `tempoLimitePadrao` 3601 e -1; `xpPorNivel` 0; campo `xpNivel`; campo `toString`; um válido junto com um inválido; corpo que é lista | 400 DADOS_INVALIDOS, e nada gravado (nem o campo válido do corpo recusado) | 400 nos doze; parâmetros iguais aos de antes | Conforme |
| As 53 chamadas não implementadas (49 operações HTTP) | Chamar cada uma delas, uma requisição por operação | 404: estão documentadas no Swagger como "(ainda não implementada)" | 404 nas 49 operações | Conforme |

As 53 chamadas cabem em 49 operações porque `PATCH /turmas/:id` serve a
quatro chamadas (renomear, trocar capa, arquivar, desarquivar) e
`GET /turmas` serve a duas (ativas e arquivadas). Essa linha é do teste de
06/10/2026; desde 13/10/2026 as 54 chamadas do contrato estão
implementadas, e nenhuma responde mais "(ainda não implementada)".

## 2. Lista de pendências

### Rotas não implementadas (0)

Nenhuma. Desde 13/10/2026 as 54 chamadas do contrato (50 operações HTTP)
estão no back, testadas pelos onze scripts de `back/test/`. As últimas 22
foram o grupo Solo (10), `GET /turmas/:id`, as cinco do próprio aluno
(`/aluno/historico`, `/aluno/resumo`, `/aluno/salas`, `/aluno/salas/:turmaId`
e `/turmas/:turmaId/meu-desempenho`) e as seis de administração
(`/categorias` e `/parametros`).

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
    Implementada em 10/10/2026.

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
    **Correção (feita em 13/10/2026):** coluna `Users.Administrador`
    (BOOLEAN, FALSE por padrão) no `DB_Teclar_v9.sql`, `prisma db pull`
    refeito e a conta `ana@teclar.dev` (u-3) marcada no seed. Na mesma
    versão, `Configuracoes.xp_por_nivel` passou de 100 para 200, o valor que
    o front, o mock e o contrato já usavam, e `CampanhasSolo.JogadorID`
    ganhou UNIQUE (dois `POST /solo/campanha` simultâneos criavam duas
    campanhas).

22. **Seed sem aluno em turma arquivada.** O teste de turma arquivada
    precisou arquivar a turma-1 temporariamente.
    **Correção:** pôr um aluno na turma-8 (já arquivada) no seed.

### Defeitos que os testes pegaram

23. **Dias seguidos em UTC** (29/10/2026). O `testar-aluno.mjs` falhou às
    22h27 de Brasília: o resumo da Lia deu 4 dias seguidos, e não 3. O back
    tirava o dia da data em UTC (`diaDe`, em `back/src/sessoes/dias-seguidos.ts`),
    então toda sessão das 21h à meia-noite de Brasília caía no dia seguinte
    e podia criar ou quebrar uma sequência. O próprio teste também dependia
    da hora em que rodava (sessões em "agora menos N dias").
    **Correção (feita em 29/10/2026):** `diaDe` usa o calendário de Brasília
    (UTC-3 fixo; sem horário de verão desde 2019). Vale para o ranking, o
    resumo do aluno e o meu-desempenho (dias seguidos) e para as rotas que
    devolvem só a data: `dataCriacao` da turma, `entrouEm` do aluno e
    `atribuidoEm`. O seed passou a gravar as datas fixas ao meio-dia de
    Brasília (meia-noite UTC já seria o dia anterior). O teste grava em
    hora fixa de Brasília e ganhou o caso das 22h.
    No front (`js/utils/formato.ts`, `emBrasilia`), a mesma regra: o dia
    da sequência e da semana do lobby (`js/utils/desempenho.ts`) e a data e
    a hora das tabelas (`formatarDataHora` e `formatarData`) saem no relógio
    de Brasília. Antes, uma sessão às 22h aparecia como 01h do dia seguinte.
    `js/utils/desempenho.check.mjs` ganhou o caso das 22h. Os testes de
    ranking e relatórios também passaram a gravar em hora fixa de Brasília.

24. **Limite de login só por IP** (29/10/2026). Com 5 tentativas por
    minuto por IP, certas ou erradas, os scripts de teste — que entram
    quase todos como `prof@teclar.dev` — passaram a levar 429 uns depois
    dos outros. Na escola seria pior: a turma inteira sai pelo mesmo IP.
    **Correção (feita em 29/10/2026):** só a senha errada conta, por IP +
    pessoa (o e-mail; no aluno, o código da turma + o nome), e o login
    certo zera a contagem (`back/src/autenticacao/tentativas-de-login.ts`).
    As outras rotas ficam no limite geral de 1000 por minuto por IP.

25. **Sessões empatadas no mesmo segundo** (29/10/2026). O
    `js/nucleo/api.back.check.mjs` falhou em "escola.aluno.historico, mais
    recente primeiro": duas sessões gravadas uma logo depois da outra
    tinham a mesma `Data_Sessao` (`TIMESTAMP(0)`, só até o segundo), e a
    ordem entre elas ficava indefinida. No uso real isso acontece quando a
    fila de sessões envia de uma vez as que guardou sem internet.
    **Correção (feita em 29/10/2026):** `Data_Sessao` passou a
    `TIMESTAMP(3)` em `SessionsProf` e `SessionsSolo` (no
    `DB_Teclar_v9.sql` e no `schema.prisma`), e toda lista de sessões
    ordena por data e, no empate, por id, no mesmo sentido (histórico do
    aluno, sessões do aluno no relatório, desempenho do aluno, histórico e
    estatísticas do Solo). O `testar-solo.mjs` não espera mais 1 segundo
    entre uma sessão e outra.

26. **Atribuições empatadas no mesmo segundo** (29/10/2026). Atribuir
    vários exercícios na mesma chamada grava todos com a mesma
    `Data_Atribuicao` (`DATETIME`, só até o segundo), e a ordem entre eles
    nas atribuições da turma e na sala do aluno ficava indefinida. O
    `testar-aluno.mjs` contornava isso dando uma data diferente a cada
    atribuição.
    **Correção (feita em 29/10/2026), sem mudar o banco:** as três consultas
    que ordenam por `Data_Atribuicao` desempatam pelo título do exercício,
    em ordem alfabética, e por fim pelo id do exercício (dois títulos
    iguais). O `testar-aluno.mjs` manteve o caso das datas diferentes e
    ganhou um com três atribuições na mesma chamada, fora da ordem
    alfabética, mais uma atribuída depois com título que viria antes no
    alfabeto: a sala e a lista do professor vêm A, B, C e depois ela.
