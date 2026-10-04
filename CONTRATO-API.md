# Contrato da API — TECLAR

> Gerado de `js/nucleo/api.ts` por `gerar-contrato.mjs`. **Não edite este arquivo:**
> mude o comentário da rota no api.ts e rode `node gerar-contrato.mjs` de novo.
> Se este arquivo e o api.ts divergirem, vale o api.ts.

59 chamadas em 10 grupos. Os tipos citados (Turma, Sessao...) estão em `js/nucleo/tipos.ts`.

## Colunas que ainda não existem no banco

O contrato abaixo já usa estas colunas. Até a migração, só o mock responde como se elas existissem.

- [ ] **Alunos.UserID** — FK para Users.ID: liga a entrada de aluno (o RP) à conta dona. Toda conta tem exatamente uma linha em Alunos, criada no cadastro. É dela que sai o nome do aluno.
  Usada em: `POST /auth/cadastro`, `GET /conta/rp`, `GET /turmas/:id/alunos`.
- [ ] **ClassMembers.Status** — ENUM 'convidado' | 'ativo' | 'recusado'. O professor convida pelo RP; só com Status = 'ativo' o aluno está na turma e conta em contador, média e relatório.
  Usada em: `GET /turmas`, `GET /turmas/:id/alunos`, `POST /turmas/:id/convites`, `GET /aluno/salas`, `GET /aluno/convites`, `POST /aluno/convites/:turmaId/aceitar`, `POST /aluno/convites/:turmaId/recusar`.
- [ ] **ClassMembers.Data_Convite** — DATETIME em que o professor convidou. É o "convidadoEm" das respostas.
  Usada em: `POST /turmas/:id/convites`.
- [ ] **Turmas.Ativa** — BOOLEAN DEFAULT TRUE. Arquivar põe FALSE, desarquivar volta a TRUE; GET /turmas devolve só as TRUE e GET /turmas?ativa=false, só as FALSE. Substitui a antiga coluna Status ('Ativa'/'Encerrada'), que não é mais pedida.
  Usada em: `GET /turmas`, `GET /turmas?ativa=false`, `PATCH /turmas/:id`, `GET /aluno/salas`.
- [ ] **Turmas.CapaSemente** — INT NULL: a semente do desenho da capa do cartão. NULL: a tela deriva uma do id da turma.
  Usada em: `PATCH /turmas/:id`.

## Colunas que já existem e mudam de significado

Não é para criar: a coluna existe. O que muda na v6 é o que ela guarda.

- [ ] **ClassMembers.Data_Matricula** — deixa de ser a data em que o professor matriculou o aluno e passa a ser a data em que o ALUNO ACEITOU o convite. Fica NULL enquanto Status = 'convidado' e é preenchida no aceite (POST /aluno/convites/:turmaId/aceitar). É o "entrouEm" das respostas. A data do convite é Data_Convite.
  Usada em: `POST /aluno/convites/:turmaId/aceitar`.

## Decisões de banco em aberto

- **Papel de administrador** — POST, PATCH e DELETE /categorias e PUT /parametros exigem administrador, mas a tabela Users não tem coluna de papel. O back precisa de um jeito de saber quem é administrador (uma coluna ou uma tabela). Até lá, o mock não tem nenhum.

## Convenções de todas as rotas

- Toda rota, menos as três públicas de /auth (login, cadastro e logout), exige o cabeçalho Authorization: Bearer <token>. Token ausente, vencido ou inválido: 401 TOKEN_INVALIDO, e a tela volta ao login.
- Corpo de erro: { "mensagem": "...", "codigo": "NAO_ENCONTRADO" }. A tela decide pelo status e pelo código, nunca pelo texto da mensagem.
- A identidade SEMPRE sai do token. Recurso de outra conta responde 404, igual ao que não existe — 403 confirmaria que ele existe. 403 TIPO_INVALIDO é só para o tipo de token errado (conta numa rota de aluno, aluno numa rota de conta).
- Sucesso sem corpo (DELETE, recusar convite, logout): 204. Datas em ISO 8601 ("2026-10-03T14:20:00.000Z"; só a data: "2026-10-03").
- Média que o back não pôde calcular (sem amostra) vem null, nunca 0: zero é informação diferente. A tela mostra "—".
- Listas que crescem sem teto vêm paginadas: { "total": 12, "pagina": 1, "itens": [...] }. As curtas, array puro.

## Índice

- **Autenticação**: `POST /auth/login`, `POST /auth/cadastro`, `GET /auth/eu`, `POST /auth/logout`
- **Conta**: `GET /conta/rp`, `POST /conta/rp/nova-senha`
- **Solo**: `GET /solo/campanha`, `POST /solo/campanha`, `GET /solo/campanhas/:id`, `DELETE /solo/campanhas/:id`, `GET /solo/missoes`, `GET /solo/missoes/:id`, `POST /solo/sessoes`, `GET /solo/historico`, `GET /solo/indicadores`, `GET /solo/estatisticas`
- **Turmas (professor)**: `GET /turmas`, `GET /turmas?ativa=false`, `POST /turmas`, `GET /turmas/:id`, `PATCH /turmas/:id` (renomear), `PATCH /turmas/:id` (trocarCapa), `PATCH /turmas/:id` (arquivar), `PATCH /turmas/:id` (desarquivar), `GET /turmas/:id/atribuicoes`, `POST /turmas/:id/atribuicoes`, `DELETE /turmas/:id/atribuicoes/:exercicioId`
- **Alunos e convites (professor)**: `GET /turmas/:id/alunos`, `DELETE /turmas/:id/alunos/:rp`, `POST /turmas/:id/convites`, `POST /turmas/:id/convites/importar`, `DELETE /turmas/:id/convites/:rp`, `GET /turmas/:id/alunos/:rp/desempenho`
- **Relatórios (professor)**: `GET /turmas/:id/relatorio`, `GET /turmas/:id/relatorio/alunos`, `GET /turmas/:id/relatorio/exercicios`, `GET /turmas/:id/alunos/:rp/sessoes`
- **Biblioteca de exercícios (professor)**: `GET /exercicios`, `GET /exercicios/:id?turma=:turmaId`, `POST /exercicios`, `PATCH /exercicios/:id`, `DELETE /exercicios/:id`
- **Sessões**: `POST /sessoes`, `GET /sessoes/:id`
- **Aluno**: `GET /aluno/historico`, `GET /aluno/resumo`, `GET /aluno/salas`, `GET /aluno/salas/:turmaId`, `GET /aluno/convites`, `POST /aluno/convites/:turmaId/aceitar`, `POST /aluno/convites/:turmaId/recusar`, `GET /turmas/:turmaId/meu-desempenho`, `GET /turmas/:turmaId/ranking`
- **Administração**: `GET /categorias`, `POST /categorias`, `PATCH /categorias/:id`, `DELETE /categorias/:id`, `GET /parametros`, `PUT /parametros`

## Autenticação

Um login para as duas tabelas: Users entra por e-mail; Alunos entra pelo RP e pela senha de aluno. As três primeiras rotas são PÚBLICAS: nelas 401 quer dizer "credencial errada", não "sessão expirada".

### `POST /auth/login`

Chamada no front: `api.auth.entrar`

**Corpo:**

Conta: { email, senha }. Aluno: { perfil: "Aluno", rp, senha } (Credenciais)

```json
{ "email": "prof@teclar.dev", "senha": "senha123" }
{ "perfil": "Aluno", "rp": "RP2025043", "senha": "Aluno#2025" }
```

**Resposta:**

200 RespostaLogin

```json
{ "token": "eyJhbGciOi...",
  "usuario": { "id": "u-2", "nome": "Henrique Lima", "email": "prof@teclar.dev",
               "tipo": "conta", "campanhaAtiva": "camp-2" } }
Aluno: { "token": "...", "usuario": { "id": "RP2025043", "nome": "Ana Pires", "tipo": "aluno",
         "turmas": [{ "id": "turma-1", "nome": "9º Ano A — Manhã" }] } }
```

**Erros:**

- 401 CREDENCIAIS — e-mail/RP ou senha errados (mesma mensagem para os dois, existindo a conta ou não)
- 403 CONTA_INATIVA — a conta existe e está desativada

**Identidade:**

Pública. O token devolvido carrega o id e o tipo de quem entrou.

**Regras de negócio no back (a tela não calcula):**

O `tipo` é a tabela em que o back autenticou ('conta' = Users, 'aluno' = Alunos), nunca o que a tela mandou. O RP aceita espaço e minúscula ("rp 2025043"): o back normaliza antes de procurar. A tela apara as pontas da senha (de conta e de aluno) antes de enviar; o back faz o mesmo antes de comparar o hash.

**Notas:**

Senha colada costuma trazer um espaço ou uma quebra de linha no fim, e isso virava "senha incorreta". Aparar no login só é seguro porque nenhuma senha válida tem espaço nas pontas: ver a regra no POST /auth/cadastro e no POST /conta/rp/nova-senha.

### `POST /auth/cadastro`

Chamada no front: `api.auth.cadastrar`

**Corpo:**

DadosCadastro

```json
{ "nome": "Henrique Lima", "email": "prof@teclar.dev", "senha": "senha123" }
```

**Resposta:**

200 RespostaCadastro — a sessão, como no login, mais a entrada de aluno

```json
{ "token": "...", "usuario": { "id": "u-9", "nome": "Henrique Lima",
  "email": "prof@teclar.dev", "tipo": "conta" },
  "rp": "RP2026117", "senhaAluno": "Kx7#pq2M" }
```

**Erros:**

- 400 DADOS_INVALIDOS — a senha começa ou termina com espaço
- 409 EMAIL_EM_USO — o e-mail já tem conta

**Identidade:**

Pública.

**Regras de negócio no back (a tela não calcula):**

Cria a linha em Users E a linha em Alunos (com Alunos.UserID apontando para a conta nova), gerando o RP e a senha de aluno. senhaAluno sai em texto puro SÓ nesta resposta; depois o back guarda apenas o hash. Recusa senha que comece ou termine com espaço (no meio pode), e grava a senha como veio, sem aparar. A senha de aluno gerada também nunca tem espaço nas pontas.

**Notas:**

Quem acabou de se cadastrar não passa pelo login de novo. A regra do espaço existe porque o login apara as pontas da senha: uma conta criada com "abc12345 " nunca mais entraria. A tela já barra antes de enviar, mas o back precisa barrar também.

### `GET /auth/eu`

Chamada no front: `api.auth.eu`

**Corpo:** nenhum.

**Resposta:**

200 Usuario — o dono do token, na forma do login

```json
{ "id": "u-2", "nome": "Henrique Lima", "email": "prof@teclar.dev", "tipo": "conta" }
```

**Erros:**

- 401 TOKEN_INVALIDO

**Identidade:**

O token. Não recebe id: é sempre "quem sou eu".

### `POST /auth/logout`

Chamada no front: `api.auth.sair`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Identidade:**

O token, que deixa de valer. Marcada como pública: um 401 aqui não pode derrubar a tela no meio da saída.

**Notas:**

Pode falhar em silêncio: quem apaga a sessão local é o sessao.sair(), que não depende desta resposta.

## Conta

A conta logada, fora de qualquer mundo. Token de aluno nestas rotas é 403: são da conta (Users), não da entrada de aluno.

### `GET /conta/rp`

Chamada no front: `api.conta.rp`

**Corpo:** nenhum.

**Resposta:**

200 RpDaConta

```json
{ "rp": "RP2025043" }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token. Sem parâmetro: é sempre o RP da própria conta.

**Regras de negócio no back (a tela não calcula):**

O RP é a linha de Alunos ligada à conta por Alunos.UserID. Conta sem linha em Alunos: { "rp": null }.

### `POST /conta/rp/nova-senha`

Chamada no front: `api.conta.novaSenhaAluno`

**Corpo:** nenhum.

**Resposta:**

200 NovaSenhaAluno — a senha nova, uma vez

```json
{ "senhaAluno": "Q2w#e4Rt" }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno
- 404 NAO_ENCONTRADO — a conta não tem RP

**Identidade:**

O token. Sem parâmetro: troca sempre a senha da própria conta.

**Regras de negócio no back (a tela não calcula):**

Gera a senha, grava só o hash e invalida a antiga na mesma hora. Não existe rota de LEITURA da senha de aluno. A senha gerada nunca tem espaço nas pontas: o login apara antes de enviar.

## Solo

O mundo Solo é da CONTA (Users). Token de aluno em qualquer rota daqui é 403 TIPO_INVALIDO. Um jogador tem UMA campanha, e ela sai do token: nenhuma rota usada pelas telas recebe id de campanha.

### `GET /solo/campanha`

Chamada no front: `api.solo.campanhaAtual`

**Corpo:** nenhum.

**Resposta:**

200 Campanha | null — null quando o jogador ainda não começou

```json
{ "campanhaId": "camp-1", "jogadorId": "u-1", "nivelAtual": 4, "xpTotal": 669 }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token (JogadorID). Não recebe id.

**Notas:**

null é ESTADO, não falha: é a primeira vez dele no Solo, e o lobby mostra o convite de começar. 404 obrigaria a tela a tratar isso dentro de um catch.

### `POST /solo/campanha`

Chamada no front: `api.solo.criarCampanha`

**Corpo:**

Nenhum.

**Resposta:**

200 Campanha — a nova (nível 1, 0 XP) ou a que já existia

```json
{ "campanhaId": "camp-7", "jogadorId": "u-3", "nivelAtual": 1, "xpTotal": 0 }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token (JogadorID).

**Regras de negócio no back (a tela não calcula):**

Idempotente: quem já tem campanha recebe a que existe, e nenhuma segunda é criada (clique duplo, aba duplicada, F5).

**Notas:**

Sem corpo porque CampanhasSolo só tem as quatro colunas: não há nome de personagem nem avatar para mandar.

### `GET /solo/campanhas/:id`

Chamada no front: `api.solo.campanha`

**Corpo:** nenhum.

**Resposta:**

200 Campanha

```json
{ "campanhaId": "camp-1", "jogadorId": "u-1", "nivelAtual": 4, "xpTotal": 669 }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe, ou é de outra conta (o mesmo 404)
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token. Só o dono lê: campanha cujo JogadorID não é a conta do token responde 404, nunca 403.

**Notas:**

Nenhuma tela usa: as telas pedem a campanha do token em GET /solo/campanha, sem id.

### `DELETE /solo/campanhas/:id`

Chamada no front: `api.solo.apagarCampanha`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — não existe, ou é de outra conta (o mesmo 404)
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token. Só o dono apaga: campanha cujo JogadorID não é a conta do token responde 404, nunca 403.

**Notas:**

Nenhuma tela usa.

### `GET /solo/missoes`

Chamada no front: `api.solo.missoes`

**Corpo:** nenhum.

**Resposta:**

200 Missao[] — as 76 lições, na ordem do percurso, SEM o texto

```json
[{ "exerciseId": "solo-001", "ordem": 1, "nivel": 1,
   "titulo": "Lição 01 — Linha-guia", "dificuldade": "facil",
   "repeticoes": 10, "tempoLimiteSegundos": 472, "tamanhoCaracteres": 59 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — a conta ainda não tem campanha

**Identidade:**

O token (precisa ter campanha). Não recebe id.

**Regras de negócio no back (a tela não calcula):**

Nenhuma lição vem bloqueada: ExerciciosSolo não tem nível mínimo. Quem agrupa por nível é a tela.

**Notas:**

Aceita filtros em query string (montarQuery), mas nenhuma tela manda filtro hoje. O texto fica de fora: na lista seria ~30 KB que nenhum cartão mostra.

### `GET /solo/missoes/:id`

Chamada no front: `api.solo.missao`

**Corpo:** nenhum.

**Resposta:**

200 MissaoDetalhe — a lição com o texto

```json
{ "exerciseId": "solo-001", "ordem": 1, "nivel": 1,
  "titulo": "Lição 01 — Linha-guia", "dificuldade": "facil",
  "repeticoes": 10, "tempoLimiteSegundos": 472, "tamanhoCaracteres": 59,
  "texto": "asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg" }
```

**Erros:**

- 404 NAO_ENCONTRADO — lição inexistente

**Identidade:**

Qualquer token válido. As lições são conteúdo semeado, iguais para todos: não há recurso "de outra conta" aqui.

### `POST /solo/sessoes`

Chamada no front: `api.solo.registrarSessao`

**Corpo:**

DadosSessaoTreino — o que o motor mediu, mais a lição

```json
{ "exercicio_id": "solo-009", "wpm": 38, "precisao": 95, "acertos": 57,
  "erros": 3, "tempo_gasto_segundos": 96, "concluida": true }
```

**Resposta:**

200 RespostaSessaoSolo — o id abre a tela de resultado

```json
{ "id": "hs-11", "xpGanho": 74, "xpTotal": 743, "nivelAtual": 4,
  "subiuDeNivel": false, "recordePessoal": true }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno
- 404 NAO_ENCONTRADO — sem campanha, ou lição inexistente

**Identidade:**

O token: a sessão vai para a campanha DO TOKEN. Não aceita campanha_id no corpo — com ele, dava para gravar XP na campanha de outro jogador.

**Regras de negócio no back (a tela não calcula):**

XP ganho (concluída: XP_BASE_MISSAO + bônus proporcional à precisão; não concluída: 30% do base), o novo XPTotal, o nível (recalculado do XP), subiuDeNivel e recordePessoal (PPM maior que o melhor anterior NESTA lição). A tela não calcula XP nem nível.

### `GET /solo/historico`

Chamada no front: `api.solo.historico`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<SessaoSolo> — as sessões da campanha

```json
{ "total": 10, "pagina": 1, "itens": [
  { "id": "hs-10", "exerciseId": "solo-015", "wpm": 41, "precisao": 92,
    "tempoSegundos": 84, "acertos": 46, "erros": 4, "concluida": true,
    "xpGanho": 73, "data": "2026-10-02T21:10:00.000Z" } ] }
```

**Erros:**

- 404 NAO_ENCONTRADO — a conta ainda não tem campanha

**Identidade:**

O token. Não recebe id: era /solo/campanhas/:id/historico, e um id de campanha na URL é um caminho para o histórico de outra pessoa.

**Notas:**

Aceita filtros em query string; as telas não mandam nenhum.

### `GET /solo/indicadores`

Chamada no front: `api.solo.indicadores`

**Corpo:** nenhum.

**Resposta:**

200 IndicadoresSolo

```json
{ "campanhaId": "camp-1", "nivelAtual": 4, "xpTotal": 669, "sessoesTotais": 10,
  "wpmMedio": 35, "precisaoMedia": 91, "melhorWpm": 41 }
```

**Erros:**

- 404 NAO_ENCONTRADO — a conta ainda não tem campanha

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

Médias só das sessões concluídas, inteiras; null sem nenhuma (nunca 0). melhorWpm considera todas as sessões.

### `GET /solo/estatisticas`

Chamada no front: `api.solo.estatisticas`

**Corpo:** nenhum.

**Resposta:**

200 EstatisticasSolo

```json
{ "campanhaId": "camp-1", "licoesConcluidas": 5, "melhorWpm": 41, "melhorPrecisao": 96,
  "porLicao": [{ "exerciseId": "solo-015", "titulo": "Lição 15 — Vocabulário real",
    "nivel": 3, "tentativas": 2, "melhorWpm": 41, "melhorPrecisao": 92,
    "ultimaVez": "2026-10-02T21:10:00.000Z" }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — a conta ainda não tem campanha

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

licoesConcluidas = lições DISTINTAS com sessão concluída; o agregado por lição (tentativas, melhores marcas, última vez) com o JOIN em ExerciciosSolo para título e nível. Lição nunca tentada não aparece.

**Notas:**

Nível e XP não vêm aqui (são de /solo/campanha). Sequência de dias e evolução a tela deriva das datas e dos PPM do histórico.

## Turmas (professor)

Mundo ESCOLA, lado do professor. A turma é da conta do token (Turmas.ProfessorID): token de aluno é 403 TIPO_INVALIDO, e turma de OUTRA conta responde 404 NAO_ENCONTRADO — o mesmo de turma que não existe, para não confirmar a quem tenta ids que ela existe.

### `GET /turmas`

Chamada no front: `api.turmas.listar`

**Corpo:** nenhum.

**Resposta:**

200 Turma[] — só as com ativa = true, array puro (lista curta)

```json
[{ "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã",
   "totalAlunos": 4, "totalExercicios": 3, "convitesPendentes": 0,
   "periodo": "2026 · 1º semestre", "capaSemente": 7001, "ativa": true,
   "dataCriacao": "2026-02-01" }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token: WHERE ProfessorID = conta do token.

**Regras de negócio no back (a tela não calcula):**

totalAlunos (COUNT em ClassMembers com Status = 'ativo'), totalExercicios (COUNT em AtribuicoesProf) e convitesPendentes (COUNT com Status = 'convidado'). O filtro é Turmas.Ativa. O texto de `periodo` vem pronto. A tela não soma nada por turma.

### `GET /turmas?ativa=false`

Chamada no front: `api.turmas.listarArquivadas`

**Corpo:** nenhum.

**Resposta:**

200 Turma[] — só as arquivadas (Turmas.Ativa = false), mesma forma de item de GET /turmas

```json
[{ "id": "turma-8", "professorId": "u-2", "nome": "8º Ano B — 2025",
   "totalAlunos": 0, "totalExercicios": 0, "convitesPendentes": 0,
   "periodo": "2025 · 2º semestre", "capaSemente": 7823, "ativa": false,
   "dataCriacao": "2025-08-04" }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token, como em GET /turmas.

**Notas:**

É a mesma rota de listar(); só o filtro muda. Serve ao "Mostrar arquivadas" da tela de turmas.

### `POST /turmas`

Chamada no front: `api.turmas.criar`

**Corpo:**

{ nome } — 3 a 100 caracteres

```json
{ "nome": "7º Ano C — Tarde" }
```

**Resposta:**

200 Turma — já na forma de um item de GET /turmas

```json
{ "id": "turma-9", "professorId": "u-2", "nome": "7º Ano C — Tarde",
  "totalAlunos": 0, "totalExercicios": 0, "convitesPendentes": 0,
  "ativa": true, "dataCriacao": "2026-10-03" }
```

**Erros:**

- 400 DADOS_INVALIDOS — nome fora de 3 a 100 caracteres
- 409 — a conta já tem uma turma com esse nome
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token vira o ProfessorID. Não aceita professorId no corpo.

**Regras de negócio no back (a tela não calcula):**

Nasce com Ativa = true. O período, se houver, é o back que monta.

**Notas:**

A tabela Turmas não tem ano nem semestre para a tela preencher. O mock ainda não valida o nome no POST (só no PATCH); a tela valida antes.

### `GET /turmas/:id`

Chamada no front: `api.turmas.obter`

**Corpo:** nenhum.

**Resposta:**

200 TurmaDetalhe — a turma mais o PPM médio

```json
{ "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã",
  "totalAlunos": 4, "totalExercicios": 3, "periodo": "2026 · 1º semestre",
  "capaSemente": 7001, "ativa": true, "dataCriacao": "2026-02-01", "ppmMedio": 33.3 }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe ou é de outra conta
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

ppmMedio com 1 casa decimal, só dos alunos que treinaram (quem nunca treinou não entra); null se ninguém treinou.

### `PATCH /turmas/:id` (renomear)

Chamada no front: `api.turmas.renomear`

**Corpo:**

{ nome } — renomear; só o campo enviado muda

```json
{ "nome": "9º Ano A — Manhã (2026)" }
```

**Resposta:**

200 Turma — a turma como ficou

```json
{ "id": "turma-1", "professorId": "u-2", "nome": "9º Ano A — Manhã (2026)",
  "totalAlunos": 4, "totalExercicios": 3, "periodo": "2026 · 1º semestre",
  "capaSemente": 7001, "ativa": true, "dataCriacao": "2026-02-01" }
```

**Erros:**

- 400 DADOS_INVALIDOS — nome fora de 3 a 100 caracteres
- 409 — a conta já tem uma turma com esse nome
- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Notas:**

PATCH porque só o campo enviado muda. A tela mantém as contagens que já tinha: o PATCH não as recalcula.

### `PATCH /turmas/:id` (trocarCapa)

Chamada no front: `api.turmas.trocarCapa`

**Corpo:**

{ capaSemente } — inteiro; troca o desenho da capa

```json
{ "capaSemente": 418207 }
```

**Resposta:**

200 Turma — a turma como ficou (mesma forma do renomear)

```json
{ "id": "turma-1", "nome": "9º Ano A — Manhã", "capaSemente": 418207, "ativa": true }
```

**Erros:**

- 400 DADOS_INVALIDOS — capaSemente não é inteiro
- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Grava em Turmas.CapaSemente. Sem semente gravada, a tela deriva uma do id — por isso a coluna aceita NULL.

### `PATCH /turmas/:id` (arquivar)

Chamada no front: `api.turmas.arquivar`

**Corpo:**

{ ativa: false } — arquivar

```json
{ "ativa": false }
```

**Resposta:**

200 Turma — a turma como ficou

```json
{ "id": "turma-3", "nome": "Projeto de Extensão 2025", "ativa": false }
```

**Erros:**

- 400 DADOS_INVALIDOS — ativa não é booleano
- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Grava Turmas.Ativa = false. A turma some de GET /turmas e o histórico de sessões fica intacto.

**Notas:**

Arquivar, e NÃO excluir: SessionsProf aponta para a turma com ON DELETE CASCADE, e apagar a turma apagaria o histórico de treino de todos os alunos dela. Por isso não existe DELETE /turmas/:id.

### `PATCH /turmas/:id` (desarquivar)

Chamada no front: `api.turmas.desarquivar`

**Corpo:**

{ ativa: true } — desarquivar

```json
{ "ativa": true }
```

**Resposta:**

200 Turma — a turma como ficou

```json
{ "id": "turma-8", "nome": "8º Ano B — 2025", "ativa": true }
```

**Erros:**

- 400 DADOS_INVALIDOS — ativa não é booleano
- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Grava Turmas.Ativa = true: a turma volta a GET /turmas como estava.

### `GET /turmas/:id/atribuicoes`

Chamada no front: `api.turmas.atribuicoes`

**Corpo:** nenhum.

**Resposta:**

200 AtribuicaoProfessor[] — o que a turma recebeu, na ordem de atribuição

```json
[{ "exercicioId": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
   "atribuidoEm": "2026-02-03", "concluidoPor": 3, "totalAlunos": 4 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

concluidoPor = alunos ATIVOS da turma com sessão concluída no exercício; totalAlunos = alunos ativos. A tela não conta.

**Notas:**

A visão do ALUNO sobre a mesma tabela é GET /aluno/salas/:id, e não traz contagem da turma: seria entregar o desempenho dos colegas.

### `POST /turmas/:id/atribuicoes`

Chamada no front: `api.turmas.atribuir`

**Corpo:**

{ exercicioIds } — vários de uma vez

```json
{ "exercicioIds": ["ex-prof-3", "ex-prof-4"] }
```

**Resposta:**

200 Atribuicao[] — a lista crua de atribuições da turma, como ficou

```json
[{ "exerciseId": "ex-prof-1", "atribuidoEm": "2026-02-03", "prazo": "2026-03-15" },
 { "exerciseId": "ex-prof-3", "atribuidoEm": "2026-10-03", "prazo": null }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma ou algum exercício não é da conta

**Identidade:**

O token: a turma E cada exercício têm de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Confere todos os ids ANTES de gravar qualquer um (metade atribuída é pior que nada). Repetir um já atribuído não duplica: a chave de AtribuicoesProf é o par (ClassID, ExerciseID).

**Notas:**

A resposta não traz título nem concluidoPor: a tela relê GET /turmas/:id/atribuicoes depois.

### `DELETE /turmas/:id/atribuicoes/:exercicioId`

Chamada no front: `api.turmas.removerAtribuicao`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o exercício não está atribuído a ela

**Identidade:**

O token: a turma tem de ser da conta.

**Notas:**

A atribuição não tem id próprio: a remoção é pelo PAR turma + exercício, a chave primária de AtribuicoesProf.

## Alunos e convites (professor)

O professor administrando o quadro de UMA turma dele. A turma sai do token (tem de ser da conta: senão 404); o aluno-alvo vai na URL pelo RP, porque é sobre ELE que a ação é — não é a identidade de quem pede. RP na URL aqui é decisão, não descuido: a identidade continua saindo do token, e o aluno só é alcançável dentro de uma turma da conta.

### `GET /turmas/:id/alunos`

Chamada no front: `api.alunos.daTurma`

**Corpo:** nenhum.

**Resposta:**

200 LinhaDaTurma[] — ativos primeiro, depois os convidados, cada um com o estado

```json
[{ "estado": "ativo", "id": "RP2025043", "nome": "Ana Pires", "entrouEm": "2026-02-01",
   "totalSessoes": 12, "wpmMedio": 39, "precisaoMedia": 91,
   "ultimaAtividade": "2026-10-03T12:00:00.000Z" },
 { "estado": "convidado", "id": "RP2025047", "nome": null,
   "convidadoEm": "2026-10-01T12:00:00.000Z" }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Junta ClassMembers com Status = 'ativo' e 'convidado' (o 'recusado' não aparece). O nome é o da conta dona do RP (Alunos.UserID -> Users.Nome). Os agregados (totalSessoes, médias, última atividade) são do aluno no sistema todo e vêm prontos; quem nunca treinou vem com null, nunca 0. Convidado não traz número.

### `DELETE /turmas/:id/alunos/:rp`

Chamada no front: `api.alunos.remover`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.

**Regras de negócio no back (a tela não calcula):**

Tira o aluno ativo da turma, e o histórico de sessões dele nesta turma vai junto. Para quem só foi convidado, é DELETE .../convites/:rp.

### `POST /turmas/:id/convites`

Chamada no front: `api.alunos.convidar`

**Corpo:**

{ rp } — de uma conta que já existe

```json
{ "rp": "RP2025001" }
```

**Resposta:**

200 ConvidadoDaTurma

```json
{ "estado": "convidado", "id": "RP2025001", "nome": "Leonardo",
  "convidadoEm": "2026-10-03T14:02:00.000Z" }
```

**Erros:**

- 400 RP_INVALIDO — fora do formato RP + 7 dígitos
- 400 CONVITE_PROPRIO — o RP é o da própria conta do token
- 404 RP_NAO_ENCONTRADO — nenhuma conta com esse RP
- 409 JA_NA_TURMA — o RP já está ativo na turma
- 409 JA_CONVIDADO — já foi convidado e ainda não respondeu
- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Normaliza o RP (sem espaço, maiúsculo) e grava ClassMembers com Status = 'convidado' e Data_Convite = agora. Ninguém entra na turma sem aceitar: o professor não cria aluno nem vê senha.

### `POST /turmas/:id/convites/importar`

Chamada no front: `api.alunos.convidarVarios`

**Corpo:**

{ rps } — o lote inteiro numa requisição

```json
{ "rps": ["RP2025001", "RP2025002", "RP2025043", "RP9999999"] }
```

**Resposta:**

200 ResultadoConvites — cada RP cai numa das três listas

```json
{ "convidados": [{ "estado": "convidado", "id": "RP2025001", "nome": "Leonardo",
                   "convidadoEm": "2026-10-03T14:02:00.000Z" }],
  "jaEstavam": [{ "rp": "RP2025043", "estado": "ativo" }],
  "falhas": [{ "rp": "RP9999999", "motivo": "Nenhuma conta com esse RP." }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Importação parcial é permitida. RP repetido na lista vira falha ("RP repetido na lista"); os outros motivos são os do convite um por um.

### `DELETE /turmas/:id/convites/:rp`

Chamada no front: `api.alunos.cancelarConvite`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou não há convite pendente para esse RP

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.

**Regras de negócio no back (a tela não calcula):**

Apaga o convite ainda não respondido; ele some da lista do aluno.

### `GET /turmas/:id/alunos/:rp/desempenho`

Chamada no front: `api.alunos.desempenho`

**Corpo:** nenhum.

**Resposta:**

200 DesempenhoAluno — os agregados e as sessões do aluno NESTA turma

```json
{ "alunoId": "RP2025043", "totalSessoes": 2, "wpmMedio": 38, "precisaoMedia": 94,
  "sessoes": [{ "id": "ses-1", "exerciseId": "ex-prof-1", "alunoId": "RP2025043",
    "wpm": 40, "precisao": 95, "tempoSegundos": 58, "acertos": 76, "erros": 4,
    "concluida": true, "data": "2026-02-18T14:10:00.000Z" }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.

**Regras de negócio no back (a tela não calcula):**

Só as sessões DESTA turma (e os agregados sobre elas): as das outras turmas do aluno são de outros professores, e este não pode vê-las.

**Notas:**

Nenhuma tela usa (o modal de relatórios usa GET /turmas/:id/alunos/:rp/sessoes).

## Relatórios (professor)

pages/professor/relatorios.html e a aba Relatório da turma. Tudo sai de SessionsProf com JOIN e chega PRONTO: nenhuma média é calculada na tela, e toda média pode vir null — que vira "—", nunca 0. A turma tem de ser da conta do token (senão 404); token de aluno é 403.

### `GET /turmas/:id/relatorio`

Chamada no front: `api.relatorios.turma`

**Corpo:** nenhum.

**Resposta:**

200 RelatorioTurma — as quatro métricas do topo

```json
{ "turmaId": "turma-1", "totalAlunos": 4, "alunosComSessao": 3, "alunosAtivos": 2,
  "wpmMedio": 33, "precisaoMedia": 87, "exerciciosConcluidos": 5 }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

alunosAtivos = alunos que treinaram nos últimos 7 dias (a janela é do back); médias inteiras das sessões concluídas da turma, null sem amostra; exerciciosConcluidos = pares (aluno, exercício) concluídos (COUNT: zero é zero).

### `GET /turmas/:id/relatorio/alunos`

Chamada no front: `api.relatorios.porAluno`

**Corpo:** nenhum.

**Resposta:**

200 RelatorioAluno[] — uma linha por aluno ATIVO, inclusive quem nunca treinou

```json
[{ "id": "RP2025049", "nome": "Marina Duarte Alves", "entrouEm": "2026-02-05",
   "totalSessoes": 2, "wpmMedio": 32, "precisaoMedia": 78,
   "ultimaAtividade": "2026-10-01T12:00:00.000Z",
   "exerciciosConcluidos": 2, "exerciciosAtribuidos": 3 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Agregados DESTA turma (só as sessões dela), diferentes dos de GET /turmas/:id/alunos, que são do sistema todo. Quem nunca treinou: totalSessoes 0 e médias null. exerciciosConcluidos = exercícios DISTINTOS concluídos.

### `GET /turmas/:id/relatorio/exercicios`

Chamada no front: `api.relatorios.porExercicio`

**Corpo:** nenhum.

**Resposta:**

200 RelatorioExercicio[] — uma linha por exercício ATRIBUÍDO; nada atribuído = []

```json
[{ "exercicioId": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
   "atribuidoEm": "2026-02-03", "concluidoPor": 2, "totalAlunos": 4,
   "wpmMedio": 37, "precisaoMedia": 87, "estouraramTempo": 1 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Médias da turma no exercício (null enquanto ninguém concluiu); estouraramTempo = sessões não concluídas, e 0 sempre que o exercício não tem tempo limite.

### `GET /turmas/:id/alunos/:rp/sessoes`

Chamada no front: `api.relatorios.sessoesDoAluno`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<SessaoDoAluno> — as sessões do aluno NESTA turma, da mais recente para a mais antiga

```json
{ "total": 2, "pagina": 1, "itens": [
  { "id": "ses-2", "exerciseId": "ex-prof-2", "alunoId": "RP2025043", "wpm": 36,
    "precisao": 92, "tempoSegundos": 61, "acertos": 80, "erros": 7, "concluida": true,
    "data": "2026-02-19T09:30:00.000Z", "tituloExercicio": "Números do cotidiano" } ] }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o RP não está ativo nela (não lista vazia)

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.

**Regras de negócio no back (a tela não calcula):**

A ordem (mais recente primeiro) é parte do contrato. O título vem do JOIN com ExerciciosProf; exercício excluído: null.

## Biblioteca de exercícios (professor)

ExerciciosProf. A listagem devolve só os do professor do token; busca e filtro de dificuldade são no cliente. Exercício de outra conta responde 404, como o que não existe.

### `GET /exercicios`

Chamada no front: `api.exercicios.listar`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<Exercicio> — paginado no contrato; quem lê passa por desembrulhar()

```json
{ "total": 4, "pagina": 1, "itens": [
  { "id": "ex-prof-1", "professorId": "u-2", "titulo": "Acentuação em foco",
    "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 120, "atribuidoA": 2 } ] }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token: WHERE ProfessorID = conta do token.

**Regras de negócio no back (a tela não calcula):**

atribuidoA = em quantas turmas está atribuído (COUNT em AtribuicoesProf). A tela não conta.

### `GET /exercicios/:id?turma=:turmaId`

Chamada no front: `api.exercicios.obter`

**Corpo:** nenhum.

**Resposta:**

200 ExercicioDetalhe — mesma forma de um item da listagem

```json
{ "id": "ex-prof-1", "professorId": "u-2", "titulo": "Acentuação em foco",
  "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 120, "atribuidoA": 2 }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe, é de outra conta, ou (aluno) não está atribuído à turma dele

**Identidade:**

Conta: o exercício tem de ser dela; ?turma= é ignorado. Aluno: ?turma= é a turma em que ele está treinando, e o exercício tem de estar atribuído a ela E ele tem de estar ativo nela.

**Notas:**

A mesma regra vale no POST /sessoes, para o aluno descobrir na ABERTURA do treino, e não depois de digitar o texto inteiro.

### `POST /exercicios`

Chamada no front: `api.exercicios.criar`

**Corpo:**

DadosExercicio — o formulário inteiro

```json
{ "titulo": "Pontuação e ritmo", "texto": "Vírgula, ponto; dois-pontos: ...",
  "dificuldade": "facil", "tempoLimiteSegundos": 0 }
```

**Resposta:**

200 Exercicio

```json
{ "id": "ex-prof-8", "professorId": "u-2", "titulo": "Pontuação e ritmo",
  "texto": "Vírgula, ponto; dois-pontos: ...", "dificuldade": "facil",
  "tempoLimiteSegundos": 0, "atribuidoA": 0 }
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token vira o ProfessorID.

**Notas:**

tempoLimiteSegundos 0 = sem limite. A contagem de caracteres não tem coluna: a tela conta do texto.

### `PATCH /exercicios/:id`

Chamada no front: `api.exercicios.atualizar`

**Corpo:**

DadosExercicio — o formulário inteiro

```json
{ "titulo": "Pontuação e ritmo", "texto": "...", "dificuldade": "medio",
  "tempoLimiteSegundos": 90 }
```

**Resposta:**

200 Exercicio — como ficou

```json
{ "id": "ex-prof-2", "professorId": "u-2", "titulo": "Pontuação e ritmo",
  "texto": "...", "dificuldade": "medio", "tempoLimiteSegundos": 90, "atribuidoA": 2 }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: o exercício tem de ser da conta.

### `DELETE /exercicios/:id`

Chamada no front: `api.exercicios.excluir`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — não existe ou é de outra conta

**Identidade:**

O token: o exercício tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

DELETE de verdade: SessionsProf e AtribuicoesProf têm ON DELETE CASCADE, então ele sai de todas as turmas e leva junto as sessões dos alunos nele. A tela avisa antes de confirmar.

## Sessões

Gravar uma sessão do mundo Escola e reler uma sessão (Escola ou Solo) na tela de resultado. A lista e o resumo das sessões do aluno são do grupo "Aluno", em /aluno/.

### `POST /sessoes`

Chamada no front: `api.sessoes.registrar`

**Corpo:**

DadosSessaoTreino — o que o motor mediu, mais o exercício e a turma

```json
{ "exercicio_id": "ex-prof-7", "turma_id": "turma-1", "wpm": 42, "precisao": 94,
  "acertos": 141, "erros": 9, "tempo_gasto_segundos": 88, "concluida": true }
```

**Resposta:**

200 RespostaSessaoEscola — a sessão gravada mais o recorde

```json
{ "id": "ses-31", "exerciseId": "ex-prof-7", "alunoId": "RP2025043",
  "turmaId": "turma-1", "wpm": 42, "precisao": 94, "tempoSegundos": 88,
  "acertos": 141, "erros": 9, "concluida": true,
  "data": "2026-10-03T14:20:00.000Z", "recordePessoal": true }
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta (o Solo grava em /solo/sessoes; a prévia do professor não grava)
- 404 NAO_ENCONTRADO — exercício não atribuído à turma, ou o aluno não está ativo nela

**Identidade:**

O token: o AlunoID sai dele, nunca do corpo.

**Regras de negócio no back (a tela não calcula):**

recordePessoal (PPM maior que o melhor anterior dele no exercício) e os agregados do aluno, que passam a contar esta sessão. PPM, precisão, acertos e erros vêm do motor da tela e são gravados como chegaram.

### `GET /sessoes/:id`

Chamada no front: `api.sessoes.obter`

**Corpo:** nenhum.

**Resposta:**

200 Sessao | SessaoSolo — a sessão gravada, com acertos e tempo

```json
Escola: { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "RP2025043",
  "turmaId": "turma-2", "wpm": 49, "precisao": 96, "tempoSegundos": 126,
  "acertos": 144, "erros": 6, "concluida": true, "data": "2026-10-03T12:00:00.000Z" }
Solo: { "id": "hs-10", "exerciseId": "solo-015", "wpm": 41, "precisao": 92,
  "tempoSegundos": 84, "acertos": 46, "erros": 4, "concluida": true,
  "xpGanho": 73, "data": "2026-10-02T21:10:00.000Z" }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe, ou é de outra pessoa (o mesmo 404)

**Identidade:**

O token. Só o DONO lê: token de aluno lê só as sessões Escola dele (SessionsProf.AlunoID); token de conta lê só as sessões Solo da campanha dele (SessionsSolo da CampanhaID do token). Sessão de outra pessoa responde 404, nunca 403. É a rota do F5 da tela de resultado: sem esta regra, trocar o ?sessao= da URL mostraria o treino de outra pessoa.

**Regras de negócio no back (a tela não calcula):**

Procura em SessionsProf e depois em SessionsSolo.

**Notas:**

É o que a tela de resultado lê num F5. Os acertos voltam aqui para ela mostrar o mesmo número de antes, sem cálculo nenhum.

## Aluno

O PRÓPRIO aluno logado: as telas de pages/aluno/. Não confundir com o grupo "Alunos e convites", que é o PROFESSOR administrando a turma dele.  Regras que o back cumpre em TODAS as rotas daqui: · O aluno sai do TOKEN (Alunos.ID). Nenhuma rota recebe RP ou id de

```
aluno na URL: não existe caminho — nem por URL editada à mão — para
um aluno pedir o histórico, a sala ou o relatório de outro.
```

· Token de conta é 403 TIPO_INVALIDO. · Turma da qual ele não participa responde 404, e não 403: o 403

```
diria "essa turma existe, só não é sua".
```

· Aceitar o convite grava ClassMembers.Status = 'ativo' e preenche

```
Data_Matricula com a data do aceite (o significado novo da v6:
antes era a data em que o professor matriculava); recusar grava
Status = 'recusado' (a linha fica, para o professor ver que o
convite foi respondido).
```

 `escola.aluno`, e não só `aluno`: é o aluno do mundo Escola. O Solo é da conta, e mora em `solo`.

### `GET /aluno/historico`

Chamada no front: `api.escola.aluno.historico`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<SessaoDoHistorico> — todas as sessões dele, da mais recente para a mais antiga

```json
{ "total": 12, "pagina": 1, "itens": [
  { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "RP2025043",
    "turmaId": "turma-2", "wpm": 49, "precisao": 96, "tempoSegundos": 126,
    "acertos": 144, "erros": 6, "concluida": true,
    "data": "2026-10-03T12:00:00.000Z",
    "tituloExercicio": "Funções em JavaScript", "nomeTurma": "Reforço de digitação" } ] }
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

O JOIN com o título do exercício e o nome da turma; a ordem é parte do contrato. Sem filtro por exercício: a tela filtra a própria lista.

### `GET /aluno/resumo`

Chamada no front: `api.escola.aluno.resumo`

**Corpo:** nenhum.

**Resposta:**

200 ResumoDoAluno — os números do topo do histórico

```json
{ "sessoesTotais": 12, "sessoesConcluidas": 11, "wpmMedio": 39, "precisaoMedia": 91,
  "melhorWpm": 49, "melhorPrecisao": 96, "diasSeguidos": 3 }
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

Médias só das concluídas (null sem nenhuma); melhores marcas de todas as sessões; diasSeguidos terminando hoje ou ontem (senão 0). Nenhuma média de turma: o aluno não recebe número de colega.

### `GET /aluno/salas`

Chamada no front: `api.escola.aluno.salas`

**Corpo:** nenhum.

**Resposta:**

200 SalaDoAluno[] — as turmas em que ele está ATIVO, com o progresso dele

```json
[{ "id": "turma-1", "nome": "9º Ano A — Manhã", "professor": "Henrique Lima",
   "capaSemente": 7001, "totalAlunos": 4, "exerciciosFeitos": 2, "exerciciosTotal": 3 }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

Só turmas com ClassMembers.Status = 'ativo' para ele e Turmas.Ativa = true. exerciciosFeitos = atribuídos com sessão dele (concluída ou tempo esgotado); totalAlunos = alunos ativos; professor = nome da conta dona.

### `GET /aluno/salas/:turmaId`

Chamada no front: `api.escola.aluno.sala`

**Corpo:** nenhum.

**Resposta:**

200 SalaDetalhe — a sala e os exercícios dela, com o estado de cada um PARA ELE

```json
{ "id": "turma-1", "nome": "9º Ano A — Manhã", "professor": "Henrique Lima",
  "capaSemente": 7001, "totalAlunos": 4, "exerciciosFeitos": 2, "exerciciosTotal": 3,
  "lista": [{ "id": "ex-prof-1", "titulo": "Acentuação em foco", "dificuldade": "medio",
    "caracteres": 247, "tempoLimiteSegundos": 120, "atribuidoEm": "2026-02-03",
    "prazo": "2026-03-15", "estado": "feito", "melhorWpm": 40, "melhorPrecisao": 95,
    "ultimaSessao": "2026-02-18T14:10:00.000Z" }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — a sala não existe ou ele não está nela
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. O :turmaId é da SALA, nunca de aluno.

**Regras de negócio no back (a tela não calcula):**

O estado de cada exercício para ele (nao_feito, feito, tempo_esgotado), a melhor marca dele e a contagem de caracteres (o texto não vem). Na ordem em que o professor atribuiu. Nenhum número de colega.

### `GET /aluno/convites`

Chamada no front: `api.escola.aluno.convites`

**Corpo:** nenhum.

**Resposta:**

200 ConviteDoAluno[] — os que esperam resposta dele, o mais recente primeiro

```json
[{ "turmaId": "turma-4", "nome": "7º Ano C — Tarde", "professor": "Henrique Lima",
   "totalAlunos": 2, "totalExercicios": 0, "convidadoEm": "2026-10-01T12:00:00.000Z" }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

ClassMembers com Status = 'convidado' para o RP dele, só de turmas ativas; totalAlunos conta só os ativos.

### `POST /aluno/convites/:turmaId/aceitar`

Chamada no front: `api.escola.aluno.aceitarConvite`

**Corpo:**

Nenhum.

**Resposta:**

200 SalaDoAluno — a sala, pronta para entrar na grade

```json
{ "id": "turma-4", "nome": "7º Ano C — Tarde", "professor": "Henrique Lima",
  "capaSemente": 7412, "totalAlunos": 3, "exerciciosFeitos": 0, "exerciciosTotal": 0 }
```

**Erros:**

- 404 NAO_ENCONTRADO — não há convite pendente dele para a turma (cancelado, já respondido, nunca existiu)
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token: só vale o convite que é DELE.

**Regras de negócio no back (a tela não calcula):**

Grava ClassMembers.Status = 'ativo' e preenche ClassMembers.Data_Matricula com a data de agora: na v6 ela é a data em que o ALUNO aceitou, e era NULL até aqui.

### `POST /aluno/convites/:turmaId/recusar`

Chamada no front: `api.escola.aluno.recusarConvite`

**Corpo:**

Nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — não há convite pendente dele para a turma
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token: só vale o convite que é DELE.

**Regras de negócio no back (a tela não calcula):**

Grava ClassMembers.Status = 'recusado'. Não tem volta pelo lado dele: só o professor pode mandar outro convite.

### `GET /turmas/:turmaId/meu-desempenho`

Chamada no front: `api.escola.aluno.desempenhoNaTurma`

**Corpo:** nenhum.

**Resposta:**

200 DesempenhoNaTurma — o relatório individual dele NA sala

```json
{ "sessoesConcluidas": 9, "licoes": 2, "diasSeguidos": 3,
  "minhaMedia": { "velocidade": 40, "precisao": 90 },
  "mediaSala":  { "velocidade": 43, "precisao": 92 } }
Abaixo de 3 sessões concluídas: { "sessoesConcluidas": 2, "licoes": 2, "diasSeguidos": 0,
  "minhaMedia": null, "mediaSala": null }
```

**Erros:**

- 404 NAO_ENCONTRADO — a turma não existe ou ele não está nela
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. O :turmaId é da turma, nunca de aluno.

**Regras de negócio no back (a tela não calcula):**

Tudo sobre as sessões DESTA turma: sessoesConcluidas; licoes (exercícios distintos concluídos); diasSeguidos; minhaMedia (PPM e precisão médios dele, inteiros) e mediaSala (das sessões concluídas de todos os alunos ativos). Com menos de 3 sessões concluídas, as duas médias vêm null. A tela não calcula média.

### `GET /turmas/:turmaId/ranking`

Chamada no front: `api.escola.aluno.rankingDaTurma`

**Corpo:** nenhum.

**Resposta:**

200 LinhaDoRanking[] — JÁ ORDENADO E PONTUADO; a tela só exibe

```json
[{ "posicao": 1, "nome": "Bruno Sato", "voce": false, "licoes": 2, "ritmo": 46,
   "diasSeguidos": 12, "pontos": 146 },
 { "posicao": 4, "nome": null, "voce": false, "licoes": 2, "ritmo": 42,
   "diasSeguidos": 8, "pontos": 122 },
 { "posicao": 6, "nome": "Ana Pires", "voce": true, "licoes": 2, "ritmo": 40,
   "diasSeguidos": 3, "pontos": 95 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — a turma não existe ou ele não está nela
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token marca a linha `voce`. O :turmaId é da turma.

**Regras de negócio no back (a tela não calcula):**

A ANONIMIZAÇÃO É DO BACK: do 4º lugar em diante, nome = null — menos na linha dele, que vem sempre com o nome. O nome dos colegas não pode chegar ao navegador, nem escondido. Sem nome no cadastro, vai o RP; nunca um nome inventado. Para cada aluno ATIVO, só com as sessões DESTA turma (SessionsProf):

```
licoes        exercícios DIFERENTES com sessão concluída
              (COUNT DISTINCT ExercicioID WHERE concluida = 1)
ritmo         PPM médio das concluídas, inteiro; null sem nenhuma
diasSeguidos  dias de calendário seguidos com sessão (concluída
              ou não), terminando HOJE ou ONTEM; senão 0
pontos = licoes * 20 + (ritmo ?? 0) + diasSeguidos * 5
```

Ordem: pontos desc; empate, mais lições; depois mais dias. posicao começa em 1.

**Notas:**

Lição pesa mais que tudo: quem fez mais exercícios fica na frente de quem só digita rápido; o ritmo entra a 1 ponto por PPM e cada dia seguido vale 5, para a constância contar. Nunca é velocidade pura.

## Administração

Categorias e parâmetros globais (tabela Configuracoes).

### `GET /categorias`

Chamada no front: `api.admin.categorias`

**Corpo:** nenhum.

**Resposta:**

200 Categoria[] — só as ativas

```json
[{ "id": 1, "nome": "Palavras comuns", "ativo": true }]
```

**Identidade:**

Qualquer token válido: ler a lista não exige papel.

### `POST /categorias`

Chamada no front: `api.admin.criarCategoria`

**Corpo:**

{ nome }

```json
{ "nome": "Atalhos de teclado" }
```

**Resposta:**

200 Categoria

```json
{ "id": 6, "nome": "Atalhos de teclado", "ativo": true }
```

**Erros:**

- 400 DADOS_INVALIDOS — nome vazio
- 409 CATEGORIA_DUPLICADA — já existe uma ativa com esse nome (sem diferenciar maiúscula)
- 404 NAO_ENCONTRADO — o token não é de administrador

**Identidade:**

O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse (ver a pendência do papel de administrador, no topo).

### `PATCH /categorias/:id`

Chamada no front: `api.admin.renomearCategoria`

**Corpo:**

{ nome }

```json
{ "nome": "Palavras do dia a dia" }
```

**Resposta:**

200 Categoria

```json
{ "id": 1, "nome": "Palavras do dia a dia", "ativo": true }
```

**Erros:**

- 404 NAO_ENCONTRADO — a categoria não existe, ou o token não é de administrador

**Identidade:**

O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.

### `DELETE /categorias/:id`

Chamada no front: `api.admin.apagarCategoria`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — a categoria não existe, ou o token não é de administrador
- 409 CATEGORIA_EM_USO — algum exercício ativo usa a categoria

**Identidade:**

O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.

**Regras de negócio no back (a tela não calcula):**

Exclusão LÓGICA (ativo = false).

### `GET /parametros`

Chamada no front: `api.admin.parametros`

**Corpo:** nenhum.

**Resposta:**

200 Parametros — a tabela Configuracoes

```json
{ "wpmMeta": 40, "precisaoMinima": 90, "tempoLimitePadrao": 60, "xpPorNivel": 200 }
```

**Identidade:**

Qualquer token válido: o lobby do Solo lê o xpPorNivel.

### `PUT /parametros`

Chamada no front: `api.admin.salvarParametros`

**Corpo:**

Partial<Parametros> — só os campos que mudam

```json
{ "wpmMeta": 45 }
```

**Resposta:**

200 Parametros — como ficou

```json
{ "wpmMeta": 45, "precisaoMinima": 90, "tempoLimitePadrao": 60, "xpPorNivel": 200 }
```

**Erros:**

- 404 NAO_ENCONTRADO — o token não é de administrador

**Identidade:**

O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.

