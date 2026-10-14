# Teste das telas — TECLAR

Roteiro do teste automático das telas (`npm run test:telas`, script em
`testes-telas/testar-telas.mjs`). Cada linha é um cenário: o que a pessoa vê,
o que ela faz e o que tem de acontecer. Foi pensado como um professor da banca
usaria o sistema: o caminho feliz e os erros que alguém comete de verdade.

**Como rodar:** com o back na porta 3000 (`npm run start:prod` em `back/`) e o
live-server servindo `teclar/` na 5500. O script roda `npm run seed` no começo
e no fim, então o banco termina limpo para a demonstração.

**Em todo cenário:**
- um erro no console do navegador é falha;
- uma resposta 4xx ou 5xx que o cenário não previu é falha (as previstas estão
  na coluna "Esperado", como o 401 da senha errada);
- quando falha, vai um print para `testes-telas/falhas/`.

**Contas** (as do seed): professor `prof@teclar.dev` / `senha123`; aluna Ana
Pires / `aluno2026` na turma-2, código `R8VD3K`. O Solo usa uma conta nova a
cada execução.

## Login e modo

| # | Tela | Ação | Esperado |
|---|---|---|---|
| L1 | login | E-mail certo, senha errada | Mensagem de erro em `#erro-conta`, continua no login, campo de senha vazio (401 previsto) |
| L2 | login | E-mail sem formato (`prof@`) | Erro no campo, nenhuma requisição sai |
| L3 | login | E-mail e senha certos | Vai para `modo.html` com "Olá, Henrique" |
| L4 | modo | Clicar no cartão Professor | Vai para `professor/turmas.html` |
| L5 | login (aluno) | Código errado | Mensagem de erro, continua no login (401 previsto) |

## Professor

| # | Tela | Ação | Esperado |
|---|---|---|---|
| P1 | turmas | Abrir | Aparecem as turmas do seed ("9º Ano A — Manhã", "Reforço de digitação") |
| P2 | turmas | Criar turma com nome novo | Toast "Turma criada", cartão novo na grade |
| P3 | turmas | Criar turma com o MESMO nome | Modal continua aberto com aviso de conflito embaixo do campo (409 previsto) |
| P4 | turmas | Arquivar a turma nova pelo "⋯" | Some da grade; "Mostrar arquivadas (n)" a mostra; "Desarquivar" a traz de volta |
| P5 | turma | "Gerar novo" código | Toast "Código novo: XXXXXX" e o código do painel muda |
| P6 | alunos | Subir CSV com um nome novo, um que já está na turma, um curto demais ("X") | Resultado com os três grupos: Adicionados, Já estavam, Falharam |
| P7 | turma › Participantes | "Remover da turma" num aluno | Toast "Aluno removido da turma", a linha some |
| P8 | turma | "Atribuir exercício", marcar um, confirmar | Toast "Exercício atribuído", a tabela da aba Exercícios o mostra |
| B1 | biblioteca | "Novo exercício" com texto curto (menos de 20 caracteres) | Erro no formulário, o modal continua aberto |
| B2 | biblioteca | Criar exercício válido | Toast "Exercício criado", linha nova na tabela |
| B3 | biblioteca | Editar o título | Toast "Exercício atualizado", título novo na tabela |
| B4 | biblioteca | Arquivar | Toast "Exercício arquivado", a linha some |
| R1 | relatórios | Escolher "Reforço de digitação" | Helena Rocha (nunca treinou) aparece com "—" |
| R2 | relatórios | Clicar no nome do Bruno Sato | Modal "Histórico do aluno" com as sessões dele |

## Aluno (Ana Pires, turma-2)

| # | Tela | Ação | Esperado |
|---|---|---|---|
| A1 | aluno/dashboard | Entrar | Sala "Reforço de digitação" com o progresso dela |
| A2 | aluno/sala | Abrir a sala | Trilha com os dois exercícios da turma |
| A3 | treino | Abrir "Funções em JavaScript" e digitar o texto inteiro | Modal "Lição enviada ao professor!" com PPM, precisão e erros |
| A4 | aluno/historico | Abrir | A sessão nova é a primeira linha da tabela |
| A5 | aluno/sala › Participantes | Abrir o ranking | Linha da Ana com a marca "você"; colegas com pontos (o 1º com 146) |

O aluno não tem `resultado.html`: o resultado dele é um modal na própria tela
de treino. O "F5 no resultado" é testado no Solo (S5).

## Primeiro acesso

| # | Tela | Ação | Esperado |
|---|---|---|---|
| PA1 | login (aluno) | Aluno recém-importado entra com senha de 3 caracteres | Erro de senha, continua no login |
| PA2 | login (aluno) | Entra com senha nova de 4 a 20 caracteres | Ainda no login, aviso "Essa é a sua senha agora" pedindo para guardá-la; "Continuar" leva ao dashboard |
| PA2b | login (aluno) | Entra de novo com a mesma senha | Vai direto para o dashboard, sem o aviso |
| PA3 | turma › Participantes | Professor clica "Zerar senha" nesse aluno | Toast "Senha zerada" |
| PA4 | login (aluno) | O aluno entra com OUTRA senha nova | O aviso de primeiro acesso aparece de novo; "Continuar" leva ao dashboard |

## Solo

| # | Tela | Ação | Esperado |
|---|---|---|---|
| S1 | cadastro | Senha e confirmação diferentes | Erro no campo, continua no cadastro |
| S2 | cadastro | Conta nova válida | Vai para `modo.html` |
| S3 | solo/dashboard | "Começar campanha" | Vai para o caminho; "Pular" no tutorial mostra a trilha |
| S4 | treino | Abrir a lição acesa e digitar todas as repetições | Vai para `resultado.html` com "+N XP" |
| S5 | resultado | F5 | Mesmos PPM, precisão e erros de antes do F5 |
| S6 | solo/estatisticas | Abrir | 1 lição concluída e o XP total da sessão |
| S7 | cadastro | O MESMO e-mail de novo | Aviso de e-mail em uso, continua no cadastro (409 previsto) |

## Sessão expirada

| # | Tela | Ação | Esperado |
|---|---|---|---|
| E1 | professor/turmas | Apagar o token do sessionStorage e recarregar | Volta para o login |
| E2 | professor/turmas | Trocar o token por um inválido e abrir uma turma | Volta para `login.html?expirou=1` com o toast "Sua sessão expirou" (401 previsto) |

## Achados da primeira execução (2026-10-14)

- **Corrigido:** conta nova que escolhia o Solo caía em "Não foi possível
  carregar o caminho" em vez do convite "Começar campanha". O caminho pedia
  missões e histórico junto com a campanha, e sem campanha o back responde 404
  a essas duas (o mock respondia). Caminho, Estatísticas e Lobby agora pedem a
  campanha primeiro e só buscam o resto se ela existir.
- **Feito depois:** o aviso de primeiro acesso não existia (o login devolvia
  `primeiroAcesso: true` e nenhuma tela usava). Agora a tela de login mostra o
  modal "Essa é a sua senha agora" antes do dashboard (PA2, PA2b e PA4).
