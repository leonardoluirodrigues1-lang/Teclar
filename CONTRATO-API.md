# Contrato da API — TECLAR

> Gerado de `js/nucleo/api.ts` por `gerar-contrato.mjs`. **Não edite este arquivo:**
> mude o comentário da rota no api.ts e rode `node gerar-contrato.mjs` de novo.
> Se este arquivo e o api.ts divergirem, vale o api.ts.

54 chamadas em 9 grupos. Os tipos citados (Turma, Sessao...) estão em `js/nucleo/tipos.ts`.

## Colunas que existem e nenhuma rota usa

Não é para criar nem para apagar: a coluna está no banco esperando a rota. Até ela existir, fica no valor padrão.

- **ExerciciosSolo.NivelMinimo** — nível da campanha que desbloqueia a lição. Nenhuma rota lê: GET /solo/missoes não manda cadeado, e a tela não bloqueia nada.
- **ExerciciosSolo.XPConcessao** — XP base da lição. Nenhuma rota lê: o XP de POST /solo/sessoes sai de uma constante do back (XP_BASE_MISSAO), igual para toda lição.
- **ExerciciosSolo.CategoriaID / ExerciciosProf.CategoriaID** — FK para Categorias. Nenhuma rota grava nem devolve: DadosExercicio não tem categoria, e a resposta de /exercicios também não.
- **AtribuicoesProf.Prazo** — data de entrega. As respostas já devolvem `prazo` (POST /turmas/:id/atribuicoes, GET /aluno/salas/:turmaId), mas nenhuma rota grava: vem sempre null.
- **ClassesProf.Ano / ClassesProf.Semestre** — de onde o back monta o texto de `periodo`. Nenhuma rota grava (POST /turmas só recebe o nome): ficam NULL, e a turma vem sem `periodo`.

## Decisões de banco em aberto

- **Papel de administrador** — POST, PATCH e DELETE /categorias e PUT /parametros exigem administrador, mas a tabela Users não tem coluna de papel. O back precisa de um jeito de saber quem é administrador (uma coluna ou uma tabela). Até lá, o mock não tem nenhum.

## Convenções de todas as rotas

- Toda rota, menos as três públicas de /auth (login, cadastro e logout), exige o cabeçalho Authorization: Bearer <token>. Token ausente, vencido ou inválido: 401 TOKEN_INVALIDO, e a tela volta ao login.
- Corpo de erro: { "mensagem": "...", "codigo": "NAO_ENCONTRADO" }. A tela decide pelo status e pelo código, nunca pelo texto da mensagem.
- A identidade SEMPRE sai do token. Recurso de outra conta responde 404, igual ao que não existe — 403 confirmaria que ele existe. 403 TIPO_INVALIDO é só para o tipo de token errado (conta numa rota de aluno, aluno numa rota de conta).
- Sucesso sem corpo (DELETE, zerar senha, logout): 204. Datas em ISO 8601 ("2026-10-03T14:20:00.000Z"; só a data: "2026-10-03").
- Média que o back não pôde calcular (sem amostra) vem null, nunca 0: zero é informação diferente. A tela mostra "—".
- Listas que crescem sem teto vêm paginadas: { "total": 12, "pagina": 1, "itens": [...] }. As curtas, array puro.

## Índice

- **Autenticação**: `POST /auth/login`, `POST /auth/cadastro`, `GET /auth/eu`, `POST /auth/logout`
- **Solo**: `GET /solo/campanha`, `POST /solo/campanha`, `GET /solo/campanhas/:id`, `DELETE /solo/campanhas/:id`, `GET /solo/missoes`, `GET /solo/missoes/:id`, `POST /solo/sessoes`, `GET /solo/historico`, `GET /solo/indicadores`, `GET /solo/estatisticas`
- **Turmas (professor)**: `GET /turmas`, `GET /turmas?ativa=false`, `POST /turmas`, `GET /turmas/:id`, `PATCH /turmas/:id` (renomear), `PATCH /turmas/:id` (trocarCapa), `PATCH /turmas/:id` (arquivar), `PATCH /turmas/:id` (desarquivar), `POST /turmas/:id/codigo/novo`, `GET /turmas/:id/atribuicoes`, `POST /turmas/:id/atribuicoes`, `DELETE /turmas/:id/atribuicoes/:exercicioId`
- **Alunos (professor)**: `GET /turmas/:id/alunos`, `POST /turmas/:id/alunos/importar`, `DELETE /turmas/:id/alunos/:alunoId`, `POST /turmas/:id/alunos/:alunoId/zerar-senha`, `GET /turmas/:id/alunos/:alunoId/desempenho`
- **Relatórios (professor)**: `GET /turmas/:id/relatorio`, `GET /turmas/:id/relatorio/alunos`, `GET /turmas/:id/relatorio/exercicios`, `GET /turmas/:id/alunos/:alunoId/sessoes`
- **Biblioteca de exercícios (professor)**: `GET /exercicios`, `GET /exercicios/:id?turma=:turmaId`, `POST /exercicios`, `PATCH /exercicios/:id`, `DELETE /exercicios/:id`
- **Sessões**: `POST /sessoes`, `GET /sessoes/:id`
- **Aluno**: `GET /aluno/historico`, `GET /aluno/resumo`, `GET /aluno/salas`, `GET /aluno/salas/:turmaId`, `GET /turmas/:turmaId/meu-desempenho`, `GET /turmas/:turmaId/ranking`
- **Administração**: `GET /categorias`, `POST /categorias`, `PATCH /categorias/:id`, `DELETE /categorias/:id`, `GET /parametros`, `PUT /parametros`

## Autenticação

Um login para as duas tabelas: Users entra por e-mail; Alunos entra pelo código da turma, o nome e a senha. As três primeiras rotas são PÚBLICAS: nelas 401 quer dizer "credencial errada", não "sessão expirada".

### `POST /auth/login`

Chamada no front: `api.auth.entrar`

**Corpo:**

Conta: { email, senha }. Aluno: { codigo, nome, senha } (Credenciais)

```json
{ "email": "prof@teclar.dev", "senha": "senha123" }
{ "codigo": "K7M2QX", "nome": "Ana Pires", "senha": "aninha2026" }
```

**Resposta:**

200 RespostaLogin — primeiroAcesso só vem (true) no aluno que acabou de criar a senha

```json
{ "token": "eyJhbGciOi...",
  "usuario": { "id": "u-2", "nome": "Henrique Lima", "email": "prof@teclar.dev",
               "tipo": "conta", "campanhaAtiva": "camp-2" } }
Aluno: { "token": "...", "primeiroAcesso": true,
         "usuario": { "id": "al-9f3k2", "nome": "Ana Pires", "tipo": "aluno",
         "turmas": [{ "id": "turma-1", "nome": "9º Ano A — Manhã" }] } }
```

**Erros:**

- 400 DADOS_INVALIDOS — primeiro acesso de aluno com senha fora de 4 a 20 caracteres
- 401 CREDENCIAIS — e-mail ou senha errados; no aluno, código, nome ou senha errados (a mesma mensagem para tudo)
- 403 CONTA_INATIVA — a conta ou o aluno está desativado, ou a turma do aluno está arquivada

**Identidade:**

Pública. O token devolvido carrega o id e o tipo de quem entrou.

**Regras de negócio no back (a tela não calcula):**

O `tipo` é a tabela em que o back autenticou ('conta' = Users, 'aluno' = Alunos), nunca o que a tela mandou: corpo com `codigo` vai em Alunos, corpo com `email` vai em Users. Aluno: o código é aparado e posto em maiúscula ("k7m2qx " = K7M2QX); o nome é aparado e tem os espaços repetidos do meio reduzidos a um, e a comparação ignora maiúscula e acento (é a collation do banco: "ana pires" acha "Ana Pires"). Procura a linha de Alunos com esse ClassID e esse Nome. REGRA DO PRIMEIRO ACESSO: Alunos.SenhaHash NULL quer dizer que o aluno ainda não entrou. Nesse caso a senha enviada é aparada e validada — de 4 a 20 caracteres, qualquer coisa serve, sem exigir letra nem número (quem digita é criança) —, o hash é GRAVADO e a resposta vem com primeiroAcesso: true. Com SenhaHash preenchido, a senha é CONFERIDA, como em qualquer login. Os dois casos entram na mesma hora. A tela apara as pontas da senha (de conta e de aluno) antes de enviar; o back faz o mesmo antes de comparar o hash.

**Notas:**

Código, nome ou senha errados dão o mesmo 401, para o login não virar um jeito de descobrir quem está em qual turma. O aluno não tem e-mail, então não existe "esqueci minha senha" automático: quem desbloqueia é o professor, em POST /turmas/:id/alunos/:alunoId/zerar-senha, e o próximo login do aluno vira primeiro acesso de novo. A regra forte (8+, letra e número) é só da senha de CONTA, no POST /auth/cadastro. Senha colada costuma trazer um espaço ou uma quebra de linha no fim, e isso virava "senha incorreta". Aparar no login só é seguro porque nenhuma senha válida tem espaço nas pontas: ver a regra no POST /auth/cadastro e a do primeiro acesso, acima.

### `POST /auth/cadastro`

Chamada no front: `api.auth.cadastrar`

**Corpo:**

DadosCadastro

```json
{ "nome": "Henrique Lima", "email": "prof@teclar.dev", "senha": "senha123" }
```

**Resposta:**

200 RespostaLogin — a sessão, como no login

```json
{ "token": "...", "usuario": { "id": "u-9", "nome": "Henrique Lima",
  "email": "prof@teclar.dev", "tipo": "conta" } }
```

**Erros:**

- 400 DADOS_INVALIDOS — a senha começa ou termina com espaço
- 409 EMAIL_EM_USO — o e-mail já tem conta

**Identidade:**

Pública.

**Regras de negócio no back (a tela não calcula):**

Cria só a linha em Users: conta não tem entrada de aluno (aluno nasce da lista que o professor sobe na turma). Recusa senha que comece ou termine com espaço (no meio pode), e grava a senha como veio, sem aparar.

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

Sem corpo porque nenhuma das seis colunas de CampanhasSolo vem da tela: CampanhaID, NivelAtual, XPTotal, Data_Criacao e Ativo são do back, e JogadorID sai do token. Não há nome de personagem nem avatar para mandar.

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

Nenhuma lição vem bloqueada: ExerciciosSolo.NivelMinimo existe desde a v7, mas esta rota não o lê (ver @nao-usado no topo). Quem agrupa por nível é a tela.

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
[{ "id": "turma-1", "codigo": "K7M2QX", "professorId": "u-2", "nome": "9º Ano A — Manhã",
   "totalAlunos": 4, "totalExercicios": 3,
   "periodo": "2026 · 1º semestre", "capaSemente": 7001, "ativa": true,
   "dataCriacao": "2026-02-01" }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token: WHERE ProfessorID = conta do token.

**Regras de negócio no back (a tela não calcula):**

totalAlunos (COUNT em Alunos com ClassID = turma e Ativo = TRUE) e totalExercicios (COUNT em AtribuicoesProf). O filtro é Turmas.Ativa. O texto de `periodo` vem pronto. A tela não soma nada por turma. `codigo` é ClassesProf.Codigo: o que o professor passa aos alunos.

### `GET /turmas?ativa=false`

Chamada no front: `api.turmas.listarArquivadas`

**Corpo:** nenhum.

**Resposta:**

200 Turma[] — só as arquivadas (Turmas.Ativa = false), mesma forma de item de GET /turmas

```json
[{ "id": "turma-8", "codigo": "P4WN8R", "professorId": "u-2", "nome": "8º Ano B — 2025",
   "totalAlunos": 0, "totalExercicios": 0,
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
{ "id": "turma-9", "codigo": "H3ZT6B", "professorId": "u-2", "nome": "7º Ano C — Tarde",
  "totalAlunos": 0, "totalExercicios": 0,
  "ativa": true, "dataCriacao": "2026-10-03" }
```

**Erros:**

- 400 DADOS_INVALIDOS — nome fora de 3 a 100 caracteres
- 409 — a conta já tem uma turma com esse nome
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token vira o ProfessorID. Não aceita professorId no corpo.

**Regras de negócio no back (a tela não calcula):**

Nasce com Ativa = true e com o código já gerado: 6 caracteres de A-Z e 2-9, sem os que se confundem ao ditar (I, O, 0, 1), único no sistema todo (ClassesProf.Codigo é UNIQUE). O período, se houver, é o back que monta.

**Notas:**

ClassesProf.Ano e Semestre existem desde a v7, mas esta rota não os recebe (ver @nao-usado no topo): a turma nasce com os dois NULL e sem `periodo`. O mock ainda não valida o nome no POST (só no PATCH); a tela valida antes.

### `GET /turmas/:id`

Chamada no front: `api.turmas.obter`

**Corpo:** nenhum.

**Resposta:**

200 TurmaDetalhe — a turma mais o PPM médio

```json
{ "id": "turma-1", "codigo": "K7M2QX", "professorId": "u-2", "nome": "9º Ano A — Manhã",
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
{ "id": "turma-1", "codigo": "K7M2QX", "professorId": "u-2", "nome": "9º Ano A — Manhã (2026)",
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

### `POST /turmas/:id/codigo/novo`

Chamada no front: `api.turmas.novoCodigo`

**Corpo:**

Nenhum.

**Resposta:**

200 CodigoDaTurma — o código novo

```json
{ "codigo": "R8VD3K" }
```

**Erros:**

- 404 NAO_ENCONTRADO — não existe ou é de outra conta
- 403 TIPO_INVALIDO — token de aluno

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Gera outro código (mesma regra do POST /turmas) e grava em ClassesProf.Codigo. O antigo deixa de valer na mesma hora: quem tentar entrar com ele toma 401 CREDENCIAIS. Quem já está logado continua logado, e os alunos que já criaram senha entram com o código novo e a MESMA senha — o código só diz qual é a turma.

**Notas:**

Existe para o caso de o código vazar (foto da lousa no grupo errado): sem ele, qualquer um com o código e um nome da lista poderia fazer o primeiro acesso no lugar do aluno.

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

concluidoPor = alunos da turma (Alunos.ClassID, Ativo = TRUE) com sessão concluída no exercício; totalAlunos = esses alunos. A tela não conta.

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
[{ "exerciseId": "ex-prof-1", "atribuidoEm": "2026-02-03", "prazo": null },
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

## Alunos (professor)

O professor administrando a lista de UMA turma dele. A turma tem de ser da conta do token (senão 404); o aluno-alvo vai na URL pelo id da linha de Alunos, porque é sobre ELE que a ação é — não é a identidade de quem pede, que continua saindo do token. Aluno de outra turma, mesmo da mesma conta, é 404 aqui: o :alunoId só vale dentro do :id.  O aluno não tem e-mail, então não existe "esqueci minha senha" automático: quem desbloqueia é o professor (zerar-senha). Também não existe convite: o aluno entra na turma quando o professor sobe o nome dele (importar).

### `GET /turmas/:id/alunos`

Chamada no front: `api.alunos.daTurma`

**Corpo:** nenhum.

**Resposta:**

200 Aluno[] — os alunos da turma, na ordem alfabética do nome

```json
[{ "id": "al-9f3k2", "nome": "Ana Pires", "entrouEm": "2026-02-01",
   "senhaDefinida": true, "totalSessoes": 12, "wpmMedio": 39, "precisaoMedia": 91,
   "ultimaAtividade": "2026-10-03T12:00:00.000Z" },
 { "id": "al-2m8qd", "nome": "Davi Moreira", "entrouEm": "2026-02-24",
   "senhaDefinida": false, "totalSessoes": 0, "wpmMedio": null, "precisaoMedia": null,
   "ultimaAtividade": null }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Alunos com ClassID = turma e Ativo = TRUE. entrouEm = Alunos.Data_Cadastro (o dia em que o nome entrou na lista); senhaDefinida = SenhaHash IS NOT NULL (false: ainda não fez o primeiro acesso, ou o professor zerou a senha). Os agregados (totalSessoes, médias, última atividade) são das sessões dele — que, na v8, são todas desta turma — e vêm prontos; quem nunca treinou vem com null, nunca 0. A senha nunca sai daqui.

### `POST /turmas/:id/alunos/importar`

Chamada no front: `api.alunos.importar`

**Corpo:**

{ nomes } — a lista inteira numa requisição; a tela lê o CSV e manda só os nomes

```json
{ "nomes": ["Ana Pires", "Bruno Sato", "ana  pires", "", "Carla Nunes"] }
```

**Resposta:**

200 ResultadoImportacao — cada nome cai numa das três listas

```json
{ "adicionados": [{ "id": "al-7c1pz", "nome": "Bruno Sato", "entrouEm": "2026-10-05",
    "senhaDefinida": false, "totalSessoes": 0, "wpmMedio": null,
    "precisaoMedia": null, "ultimaAtividade": null }],
  "jaEstavam": ["Ana Pires"],
  "falhas": [{ "nome": "ana  pires", "motivo": "Nome repetido na lista." },
             { "nome": "", "motivo": "Nome vazio." }] }
```

**Erros:**

- 400 DADOS_INVALIDOS — `nomes` não é uma lista, ou tem mais de 500 itens
- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Cada nome é aparado e tem os espaços repetidos do meio reduzidos a um (é a forma gravada e a que o aluno vai digitar). Depois: vazio, ou com menos de 2 ou mais de 150 caracteres -> falha; igual a um nome anterior da MESMA lista -> falha ("Nome repetido na lista."); igual a um aluno que já está na turma -> jaEstavam, e nada muda para ele; senão, vira uma linha nova de Alunos com ClassID = turma e SenhaHash NULL. "Igual" ignora maiúscula e acento, como o UNIQUE (ClassID, Nome) do banco. Importação parcial é permitida: uma falha não desfaz os outros. Pode ser chamada de novo com a lista completa: quem já está cai em jaEstavam.

**Notas:**

É a ÚNICA porta de entrada do aluno na turma, e por isso é obrigatória: sem o nome na lista, o login responde 401. Aluno removido por engano volta por aqui, mas como linha nova: sem a senha e sem o histórico antigos.

### `DELETE /turmas/:id/alunos/:alunoId`

Chamada no front: `api.alunos.remover`

**Corpo:** nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o aluno não é desta turma

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O :alunoId é o aluno-ALVO — sobre quem a ação é —, e não quem pede.

**Regras de negócio no back (a tela não calcula):**

Apaga a linha de Alunos; as sessões dele vão junto (SessionsProf tem ON DELETE CASCADE). Ele deixa de conseguir entrar na hora.

### `POST /turmas/:id/alunos/:alunoId/zerar-senha`

Chamada no front: `api.alunos.zerarSenha`

**Corpo:**

Nenhum.

**Resposta:**

204 (sem corpo)

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o aluno não é desta turma

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O :alunoId é o aluno-ALVO, como no DELETE.

**Regras de negócio no back (a tela não calcula):**

Grava Alunos.SenhaHash = NULL. O próximo login com esse nome nesta turma é PRIMEIRO ACESSO: a senha enviada vira a nova (ver POST /auth/login). O histórico fica intacto. Zerar quem já está com SenhaHash NULL não é erro: responde 204 do mesmo jeito.

**Notas:**

O aluno não tem e-mail, então não existe "esqueci minha senha" automático: quem desbloqueia é o professor. Até o aluno entrar de novo, qualquer um com o código e o nome dele pode criar a senha no lugar dele — por isso a tela avisa para zerar só com o aluno por perto.

### `GET /turmas/:id/alunos/:alunoId/desempenho`

Chamada no front: `api.alunos.desempenho`

**Corpo:** nenhum.

**Resposta:**

200 DesempenhoAluno — os agregados e as sessões do aluno

```json
{ "alunoId": "al-9f3k2", "totalSessoes": 2, "wpmMedio": 38, "precisaoMedia": 94,
  "sessoes": [{ "id": "ses-1", "exerciseId": "ex-prof-1", "alunoId": "al-9f3k2",
    "wpm": 40, "precisao": 95, "tempoSegundos": 58, "acertos": 76, "erros": 4,
    "concluida": true, "data": "2026-02-18T14:10:00.000Z" }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o aluno não é desta turma

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O :alunoId é o aluno-ALVO, como no DELETE.

**Regras de negócio no back (a tela não calcula):**

As sessões do aluno, que na v8 são todas desta turma, e os agregados sobre elas.

**Notas:**

Nenhuma tela usa (o modal de relatórios usa GET /turmas/:id/alunos/:alunoId/sessoes).

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

200 RelatorioAluno[] — uma linha por aluno da turma, inclusive quem nunca treinou

```json
[{ "id": "al-4hx7r", "nome": "Marina Duarte Alves", "entrouEm": "2026-02-05",
   "senhaDefinida": true, "totalSessoes": 2, "wpmMedio": 32, "precisaoMedia": 78,
   "ultimaAtividade": "2026-10-01T12:00:00.000Z",
   "exerciciosConcluidos": 2, "exerciciosAtribuidos": 3 }]
```

**Erros:**

- 404 NAO_ENCONTRADO — turma inexistente ou de outra conta

**Identidade:**

O token: a turma tem de ser da conta.

**Regras de negócio no back (a tela não calcula):**

Alunos com ClassID = turma e Ativo = TRUE. Agregados das sessões de exercícios atribuídos à turma. Quem nunca treinou: totalSessoes 0 e médias null. exerciciosConcluidos = exercícios DISTINTOS concluídos.

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

### `GET /turmas/:id/alunos/:alunoId/sessoes`

Chamada no front: `api.relatorios.sessoesDoAluno`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<SessaoDoAluno> — as sessões do aluno, da mais recente para a mais antiga

```json
{ "total": 2, "pagina": 1, "itens": [
  { "id": "ses-2", "exerciseId": "ex-prof-2", "alunoId": "al-9f3k2", "wpm": 36,
    "precisao": 92, "tempoSegundos": 61, "acertos": 80, "erros": 7, "concluida": true,
    "data": "2026-02-19T09:30:00.000Z", "tituloExercicio": "Números do cotidiano" } ] }
```

**Erros:**

- 404 NAO_ENCONTRADO — turma de outra conta, ou o aluno não é desta turma (não lista vazia)

**Identidade:**

O token: a turma tem de ser da conta (senão 404). O :alunoId é o aluno-ALVO — sobre quem a ação é —, e não quem pede.

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

Conta: o exercício tem de ser dela; ?turma= é ignorado. Aluno: ?turma= é a turma em que ele está treinando, que tem de ser a dele (Alunos.ClassID), e o exercício tem de estar atribuído a ela.

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
{ "id": "ses-31", "exerciseId": "ex-prof-7", "alunoId": "al-9f3k2",
  "turmaId": "turma-1", "wpm": 42, "precisao": 94, "tempoSegundos": 88,
  "acertos": 141, "erros": 9, "concluida": true,
  "data": "2026-10-03T14:20:00.000Z", "recordePessoal": true }
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta (o Solo grava em /solo/sessoes; a prévia do professor não grava)
- 404 NAO_ENCONTRADO — exercício não atribuído à turma, ou turma_id não é a turma do aluno

**Identidade:**

O token: o AlunoID sai dele, nunca do corpo. SessionsProf.ClassID recebe a turma do aluno (Alunos.ClassID); turma_id no corpo tem de ser ela.

**Regras de negócio no back (a tela não calcula):**

recordePessoal (PPM maior que o melhor anterior dele no exercício) e os agregados do aluno, que passam a contar esta sessão. PPM, precisão, acertos e erros vêm do motor da tela e são gravados como chegaram.

### `GET /sessoes/:id`

Chamada no front: `api.sessoes.obter`

**Corpo:** nenhum.

**Resposta:**

200 Sessao | SessaoSolo — a sessão gravada, com acertos e tempo

```json
Escola: { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "al-9f3k2",
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

O PRÓPRIO aluno logado: as telas de pages/aluno/. Não confundir com o grupo "Alunos", que é o PROFESSOR administrando a turma dele.  Regras que o back cumpre em TODAS as rotas daqui: · O aluno sai do TOKEN (Alunos.ID). Nenhuma rota recebe id de aluno

```
na URL: não existe caminho — nem por URL editada à mão — para um
aluno pedir o histórico, a sala ou o relatório de outro.
```

· Token de conta é 403 TIPO_INVALIDO. · Na v8 o aluno está em UMA turma só (Alunos.ClassID): as listas daqui

```
têm no máximo uma sala, e :turmaId que não é a dele responde 404, e
não 403 — o 403 diria "essa turma existe, só não é sua".
```

 `escola.aluno`, e não só `aluno`: é o aluno do mundo Escola. O Solo é da conta, e mora em `solo`.

### `GET /aluno/historico`

Chamada no front: `api.escola.aluno.historico`

**Corpo:** nenhum.

**Resposta:**

200 Paginado<SessaoDoHistorico> — todas as sessões dele, da mais recente para a mais antiga

```json
{ "total": 12, "pagina": 1, "itens": [
  { "id": "ses-17", "exerciseId": "ex-prof-3", "alunoId": "al-9f3k2",
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

200 SalaDoAluno[] — a turma dele (uma só; nenhuma se estiver arquivada), com o progresso dele

```json
[{ "id": "turma-1", "nome": "9º Ano A — Manhã", "professor": "Henrique Lima",
   "capaSemente": 7001, "totalAlunos": 4, "exerciciosFeitos": 2, "exerciciosTotal": 3 }]
```

**Erros:**

- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. Não recebe id.

**Regras de negócio no back (a tela não calcula):**

A turma de Alunos.ClassID, se Turmas.Ativa = true. exerciciosFeitos = atribuídos com sessão dele (concluída ou tempo esgotado); totalAlunos = alunos da turma (Ativo = TRUE); professor = nome da conta dona.

**Notas:**

Continua lista para a tela não mudar de forma; com um aluno por turma, nunca passa de um item.

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
    "prazo": null, "estado": "feito", "melhorWpm": 40, "melhorPrecisao": 95,
    "ultimaSessao": "2026-02-18T14:10:00.000Z" }] }
```

**Erros:**

- 404 NAO_ENCONTRADO — a sala não existe ou ele não está nela
- 403 TIPO_INVALIDO — token de conta

**Identidade:**

O token. O :turmaId é da SALA, nunca de aluno.

**Regras de negócio no back (a tela não calcula):**

O estado de cada exercício para ele (nao_feito, feito, tempo_esgotado), a melhor marca dele e a contagem de caracteres (o texto não vem). Na ordem em que o professor atribuiu. Nenhum número de colega.

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

Tudo sobre as sessões DESTA turma: sessoesConcluidas; licoes (exercícios distintos concluídos); diasSeguidos; minhaMedia (PPM e precisão médios dele, inteiros) e mediaSala (das sessões concluídas de todos os alunos da turma). Com menos de 3 sessões concluídas, as duas médias vêm null. A tela não calcula média.

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

A ANONIMIZAÇÃO É DO BACK: do 4º lugar em diante, nome = null — menos na linha dele, que vem sempre com o nome. O nome dos colegas não pode chegar ao navegador, nem escondido. Para cada aluno da turma (Ativo = TRUE), só com as sessões DESTA turma (SessionsProf):

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

