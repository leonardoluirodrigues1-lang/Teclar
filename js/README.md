# js/

Todo `.js` desta pasta é gerado pelo `npm run dev` a partir do `.ts`/`.tsx`
de mesmo nome. Edite sempre o `.ts`/`.tsx`.

| Pasta / arquivo | Para que serve |
|-----------------|----------------|
| `config.ts` | URL do back, `CONFIG.MOCK`, chaves do `localStorage`, regras numéricas do treino e as rotas de cada tela. |
| `nucleo/` | Base de tudo: tipos, chamadas ao back, back falso, sessão e proteção das telas. |
| `componentes/` | Peças de tela usadas em mais de um lugar (Nav, modal, tabela, barra de XP, toast...). |
| `utils/` | Funções puras, sem tela: CSV, validação, desempenho, formatação, ordenação. |
| `landing/` | Página inicial. |
| `auth/` | Login, cadastro e escolha de modo. |
| `professor/` | Telas do professor (mundo Escola). |
| `aluno/` | Telas do aluno (mundo Escola). |
| `solo/` | Telas do Solo: lobby, campanhas, estatísticas. |
| `treino/` | Motor de digitação e telas de treino e resultado, comuns aos dois mundos. |

## Ordem de leitura do núcleo

1. `config.ts` (fica em `js/`, fora do `nucleo/`): as constantes que todo o resto importa.
2. `nucleo/tipos.ts`: o formato de cada dado que vai e vem do back.
3. `nucleo/api.ts`: todas as rotas do back e o tratamento de erro.
4. `nucleo/mocks.ts`: como o back responde, as contas de teste e os erros.
5. `nucleo/sessao.ts`: quem está logado, o modo (Solo ou Professor) e a turma ativa.
6. `nucleo/guarda.ts`: quem pode abrir cada tela e para onde vai quem não pode.

Depois disso, `treino/typingEngine.ts` é o próximo arquivo a ler: é o motor
que os dois mundos compartilham.
