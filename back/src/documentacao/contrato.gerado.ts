// contrato.gerado.ts
// GERADO por gerar-contrato.mjs (na raiz do repositório) a partir de
// js/nucleo/api.ts. NÃO EDITE: mude o comentário da rota no api.ts e rode
// "npm run contrato" na raiz. É daqui que o @Documentar tira o texto do
// Swagger, para a documentação ser o contrato e não uma cópia dele.

export interface Exemplo {
  rotulo: string;
  valor: unknown;
}

export interface ErroDoContrato {
  status: number;
  codigo: string | null;
  quando: string;
}

export interface RotaDoContrato {
  grupo: string;
  metodo: string;
  caminho: string;
  query: string[];
  chamada: string;
  corpo: { descricao: string; exemplos: Exemplo[] } | null;
  resposta: { status: number; descricao: string; exemplos: Exemplo[] };
  erros: ErroDoContrato[];
  identidade: string;
  regras: string;
  notas: string;
}

export const GRUPOS: { nome: string; descricao: string }[] = [
  {
    "nome": "Autenticação",
    "descricao": "Um login para as duas tabelas: Users entra por e-mail; Alunos entra pelo RP e pela senha de aluno. As três primeiras rotas são PÚBLICAS: nelas 401 quer dizer \"credencial errada\", não \"sessão expirada\"."
  },
  {
    "nome": "Conta",
    "descricao": "A conta logada, fora de qualquer mundo. Token de aluno nestas rotas é 403: são da conta (Users), não da entrada de aluno."
  },
  {
    "nome": "Solo",
    "descricao": "O mundo Solo é da CONTA (Users). Token de aluno em qualquer rota daqui é 403 TIPO_INVALIDO. Um jogador tem UMA campanha, e ela sai do token: nenhuma rota usada pelas telas recebe id de campanha."
  },
  {
    "nome": "Turmas (professor)",
    "descricao": "Mundo ESCOLA, lado do professor. A turma é da conta do token (Turmas.ProfessorID): token de aluno é 403 TIPO_INVALIDO, e turma de OUTRA conta responde 404 NAO_ENCONTRADO — o mesmo de turma que não existe, para não confirmar a quem tenta ids que ela existe."
  },
  {
    "nome": "Alunos e convites (professor)",
    "descricao": "O professor administrando o quadro de UMA turma dele. A turma sai do token (tem de ser da conta: senão 404); o aluno-alvo vai na URL pelo RP, porque é sobre ELE que a ação é — não é a identidade de quem pede. RP na URL aqui é decisão, não descuido: a identidade continua saindo do token, e o aluno só é alcançável dentro de uma turma da conta."
  },
  {
    "nome": "Relatórios (professor)",
    "descricao": "pages/professor/relatorios.html e a aba Relatório da turma. Tudo sai de SessionsProf com JOIN e chega PRONTO: nenhuma média é calculada na tela, e toda média pode vir null — que vira \"—\", nunca 0. A turma tem de ser da conta do token (senão 404); token de aluno é 403."
  },
  {
    "nome": "Biblioteca de exercícios (professor)",
    "descricao": "ExerciciosProf. A listagem devolve só os do professor do token; busca e filtro de dificuldade são no cliente. Exercício de outra conta responde 404, como o que não existe."
  },
  {
    "nome": "Sessões",
    "descricao": "Gravar uma sessão do mundo Escola e reler uma sessão (Escola ou Solo) na tela de resultado. A lista e o resumo das sessões do aluno são do grupo \"Aluno\", em /aluno/."
  },
  {
    "nome": "Aluno",
    "descricao": "O PRÓPRIO aluno logado: as telas de pages/aluno/. Não confundir com o grupo \"Alunos e convites\", que é o PROFESSOR administrando a turma dele. Regras que o back cumpre em TODAS as rotas daqui: · O aluno sai do TOKEN (Alunos.ID). Nenhuma rota recebe RP ou id de aluno na URL: não existe caminho — nem por URL editada à mão — para um aluno pedir o histórico, a sala ou o relatório de outro. · Token de conta é 403 TIPO_INVALIDO. · Turma da qual ele não participa responde 404, e não 403: o 403 diria \"essa turma existe, só não é sua\". · Aceitar o convite grava ClassMembers.Status = 'ativo' e preenche Data_Matricula com a data do aceite (o significado novo da v6: antes era a data em que o professor matriculava); recusar grava Status = 'recusado' (a linha fica, para o professor ver que o convite foi respondido). `escola.aluno`, e não só `aluno`: é o aluno do mundo Escola. O Solo é da conta, e mora em `solo`."
  },
  {
    "nome": "Administração",
    "descricao": "Categorias e parâmetros globais (tabela Configuracoes)."
  }
];

export const CONTRATO: Record<string, RotaDoContrato> = {
  "auth.entrar": {
    "grupo": "Autenticação",
    "metodo": "POST",
    "caminho": "/auth/login",
    "query": [],
    "chamada": "api.auth.entrar",
    "corpo": {
      "descricao": "Conta: { email, senha }. Aluno: { perfil: \"Aluno\", rp, senha } (Credenciais)",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "email": "prof@teclar.dev",
            "senha": "senha123"
          }
        },
        {
          "rotulo": "",
          "valor": {
            "perfil": "Aluno",
            "rp": "RP2025043",
            "senha": "Aluno#2025"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "RespostaLogin",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "token": "eyJhbGciOi...",
            "usuario": {
              "id": "u-2",
              "nome": "Henrique Lima",
              "email": "prof@teclar.dev",
              "tipo": "conta",
              "campanhaAtiva": "camp-2"
            }
          }
        },
        {
          "rotulo": "Aluno",
          "valor": {
            "token": "...",
            "usuario": {
              "id": "RP2025043",
              "nome": "Ana Pires",
              "tipo": "aluno",
              "turmas": [
                {
                  "id": "turma-1",
                  "nome": "9º Ano A — Manhã"
                }
              ]
            }
          }
        }
      ]
    },
    "erros": [
      {
        "status": 401,
        "codigo": "CREDENCIAIS",
        "quando": "e-mail/RP ou senha errados (mesma mensagem para os dois, existindo a conta ou não)"
      },
      {
        "status": 403,
        "codigo": "CONTA_INATIVA",
        "quando": "a conta existe e está desativada"
      }
    ],
    "identidade": "Pública. O token devolvido carrega o id e o tipo de quem entrou.",
    "regras": "O `tipo` é a tabela em que o back autenticou ('conta' = Users, 'aluno' = Alunos), nunca o que a tela mandou. O RP aceita espaço e minúscula (\"rp 2025043\"): o back normaliza antes de procurar. A tela apara as pontas da senha (de conta e de aluno) antes de enviar; o back faz o mesmo antes de comparar o hash.",
    "notas": "Senha colada costuma trazer um espaço ou uma quebra de linha no fim, e isso virava \"senha incorreta\". Aparar no login só é seguro porque nenhuma senha válida tem espaço nas pontas: ver a regra no POST /auth/cadastro e no POST /conta/rp/nova-senha."
  },
  "auth.cadastrar": {
    "grupo": "Autenticação",
    "metodo": "POST",
    "caminho": "/auth/cadastro",
    "query": [],
    "chamada": "api.auth.cadastrar",
    "corpo": {
      "descricao": "DadosCadastro",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "nome": "Henrique Lima",
            "email": "prof@teclar.dev",
            "senha": "senha123"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "RespostaCadastro — a sessão, como no login, mais a entrada de aluno",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "token": "...",
            "usuario": {
              "id": "u-9",
              "nome": "Henrique Lima",
              "email": "prof@teclar.dev",
              "tipo": "conta"
            },
            "rp": "RP2026117",
            "senhaAluno": "Kx7#pq2M"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "a senha começa ou termina com espaço"
      },
      {
        "status": 409,
        "codigo": "EMAIL_EM_USO",
        "quando": "o e-mail já tem conta"
      }
    ],
    "identidade": "Pública.",
    "regras": "Cria a linha em Users E a linha em Alunos (com Alunos.UserID apontando para a conta nova), gerando o RP e a senha de aluno. senhaAluno sai em texto puro SÓ nesta resposta; depois o back guarda apenas o hash. Recusa senha que comece ou termine com espaço (no meio pode), e grava a senha como veio, sem aparar. A senha de aluno gerada também nunca tem espaço nas pontas.",
    "notas": "Quem acabou de se cadastrar não passa pelo login de novo. A regra do espaço existe porque o login apara as pontas da senha: uma conta criada com \"abc12345 \" nunca mais entraria. A tela já barra antes de enviar, mas o back precisa barrar também."
  },
  "auth.eu": {
    "grupo": "Autenticação",
    "metodo": "GET",
    "caminho": "/auth/eu",
    "query": [],
    "chamada": "api.auth.eu",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Usuario — o dono do token, na forma do login",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "u-2",
            "nome": "Henrique Lima",
            "email": "prof@teclar.dev",
            "tipo": "conta"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 401,
        "codigo": "TOKEN_INVALIDO",
        "quando": ""
      }
    ],
    "identidade": "O token. Não recebe id: é sempre \"quem sou eu\".",
    "regras": "",
    "notas": ""
  },
  "auth.sair": {
    "grupo": "Autenticação",
    "metodo": "POST",
    "caminho": "/auth/logout",
    "query": [],
    "chamada": "api.auth.sair",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [],
    "identidade": "O token, que deixa de valer. Marcada como pública: um 401 aqui não pode derrubar a tela no meio da saída.",
    "regras": "",
    "notas": "Pode falhar em silêncio: quem apaga a sessão local é o sessao.sair(), que não depende desta resposta."
  },
  "conta.rp": {
    "grupo": "Conta",
    "metodo": "GET",
    "caminho": "/conta/rp",
    "query": [],
    "chamada": "api.conta.rp",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "RpDaConta",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "rp": "RP2025043"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token. Sem parâmetro: é sempre o RP da própria conta.",
    "regras": "O RP é a linha de Alunos ligada à conta por Alunos.UserID. Conta sem linha em Alunos: { \"rp\": null }.",
    "notas": ""
  },
  "conta.novaSenhaAluno": {
    "grupo": "Conta",
    "metodo": "POST",
    "caminho": "/conta/rp/nova-senha",
    "query": [],
    "chamada": "api.conta.novaSenhaAluno",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "NovaSenhaAluno — a senha nova, uma vez",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "senhaAluno": "Q2w#e4Rt"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a conta não tem RP"
      }
    ],
    "identidade": "O token. Sem parâmetro: troca sempre a senha da própria conta.",
    "regras": "Gera a senha, grava só o hash e invalida a antiga na mesma hora. Não existe rota de LEITURA da senha de aluno. A senha gerada nunca tem espaço nas pontas: o login apara antes de enviar.",
    "notas": ""
  },
  "solo.campanhaAtual": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/campanha",
    "query": [],
    "chamada": "api.solo.campanhaAtual",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Campanha | null — null quando o jogador ainda não começou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "campanhaId": "camp-1",
            "jogadorId": "u-1",
            "nivelAtual": 4,
            "xpTotal": 669
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token (JogadorID). Não recebe id.",
    "regras": "",
    "notas": "null é ESTADO, não falha: é a primeira vez dele no Solo, e o lobby mostra o convite de começar. 404 obrigaria a tela a tratar isso dentro de um catch."
  },
  "solo.criarCampanha": {
    "grupo": "Solo",
    "metodo": "POST",
    "caminho": "/solo/campanha",
    "query": [],
    "chamada": "api.solo.criarCampanha",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Campanha — a nova (nível 1, 0 XP) ou a que já existia",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "campanhaId": "camp-7",
            "jogadorId": "u-3",
            "nivelAtual": 1,
            "xpTotal": 0
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token (JogadorID).",
    "regras": "Idempotente: quem já tem campanha recebe a que existe, e nenhuma segunda é criada (clique duplo, aba duplicada, F5).",
    "notas": "Sem corpo porque nenhuma das seis colunas de CampanhasSolo vem da tela: CampanhaID, NivelAtual, XPTotal, Data_Criacao e Ativo são do back, e JogadorID sai do token. Não há nome de personagem nem avatar para mandar."
  },
  "solo.campanha": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/campanhas/:id",
    "query": [],
    "chamada": "api.solo.campanha",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Campanha",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "campanhaId": "camp-1",
            "jogadorId": "u-1",
            "nivelAtual": 4,
            "xpTotal": 669
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe, ou é de outra conta (o mesmo 404)"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token. Só o dono lê: campanha cujo JogadorID não é a conta do token responde 404, nunca 403.",
    "regras": "",
    "notas": "Nenhuma tela usa: as telas pedem a campanha do token em GET /solo/campanha, sem id."
  },
  "solo.apagarCampanha": {
    "grupo": "Solo",
    "metodo": "DELETE",
    "caminho": "/solo/campanhas/:id",
    "query": [],
    "chamada": "api.solo.apagarCampanha",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe, ou é de outra conta (o mesmo 404)"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token. Só o dono apaga: campanha cujo JogadorID não é a conta do token responde 404, nunca 403.",
    "regras": "",
    "notas": "Nenhuma tela usa."
  },
  "solo.missoes": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/missoes",
    "query": [],
    "chamada": "api.solo.missoes",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Missao[] — as 76 lições, na ordem do percurso, SEM o texto",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "exerciseId": "solo-001",
              "ordem": 1,
              "nivel": 1,
              "titulo": "Lição 01 — Linha-guia",
              "dificuldade": "facil",
              "repeticoes": 10,
              "tempoLimiteSegundos": 472,
              "tamanhoCaracteres": 59
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a conta ainda não tem campanha"
      }
    ],
    "identidade": "O token (precisa ter campanha). Não recebe id.",
    "regras": "Nenhuma lição vem bloqueada: ExerciciosSolo.NivelMinimo existe desde a v7, mas esta rota não o lê (ver @nao-usado no topo). Quem agrupa por nível é a tela.",
    "notas": "Aceita filtros em query string (montarQuery), mas nenhuma tela manda filtro hoje. O texto fica de fora: na lista seria ~30 KB que nenhum cartão mostra."
  },
  "solo.missao": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/missoes/:id",
    "query": [],
    "chamada": "api.solo.missao",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "MissaoDetalhe — a lição com o texto",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "exerciseId": "solo-001",
            "ordem": 1,
            "nivel": 1,
            "titulo": "Lição 01 — Linha-guia",
            "dificuldade": "facil",
            "repeticoes": 10,
            "tempoLimiteSegundos": 472,
            "tamanhoCaracteres": 59,
            "texto": "asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg asdfg"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "lição inexistente"
      }
    ],
    "identidade": "Qualquer token válido. As lições são conteúdo semeado, iguais para todos: não há recurso \"de outra conta\" aqui.",
    "regras": "",
    "notas": ""
  },
  "solo.registrarSessao": {
    "grupo": "Solo",
    "metodo": "POST",
    "caminho": "/solo/sessoes",
    "query": [],
    "chamada": "api.solo.registrarSessao",
    "corpo": {
      "descricao": "DadosSessaoTreino — o que o motor mediu, mais a lição",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "exercicio_id": "solo-009",
            "wpm": 38,
            "precisao": 95,
            "acertos": 57,
            "erros": 3,
            "tempo_gasto_segundos": 96,
            "concluida": true
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "RespostaSessaoSolo — o id abre a tela de resultado",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "hs-11",
            "xpGanho": 74,
            "xpTotal": 743,
            "nivelAtual": 4,
            "subiuDeNivel": false,
            "recordePessoal": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "sem campanha, ou lição inexistente"
      }
    ],
    "identidade": "O token: a sessão vai para a campanha DO TOKEN. Não aceita campanha_id no corpo — com ele, dava para gravar XP na campanha de outro jogador.",
    "regras": "XP ganho (concluída: XP_BASE_MISSAO + bônus proporcional à precisão; não concluída: 30% do base), o novo XPTotal, o nível (recalculado do XP), subiuDeNivel e recordePessoal (PPM maior que o melhor anterior NESTA lição). A tela não calcula XP nem nível.",
    "notas": ""
  },
  "solo.historico": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/historico",
    "query": [],
    "chamada": "api.solo.historico",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Paginado<SessaoSolo> — as sessões da campanha",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "total": 10,
            "pagina": 1,
            "itens": [
              {
                "id": "hs-10",
                "exerciseId": "solo-015",
                "wpm": 41,
                "precisao": 92,
                "tempoSegundos": 84,
                "acertos": 46,
                "erros": 4,
                "concluida": true,
                "xpGanho": 73,
                "data": "2026-10-02T21:10:00.000Z"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a conta ainda não tem campanha"
      }
    ],
    "identidade": "O token. Não recebe id: era /solo/campanhas/:id/historico, e um id de campanha na URL é um caminho para o histórico de outra pessoa.",
    "regras": "",
    "notas": "Aceita filtros em query string; as telas não mandam nenhum."
  },
  "solo.indicadores": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/indicadores",
    "query": [],
    "chamada": "api.solo.indicadores",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "IndicadoresSolo",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "campanhaId": "camp-1",
            "nivelAtual": 4,
            "xpTotal": 669,
            "sessoesTotais": 10,
            "wpmMedio": 35,
            "precisaoMedia": 91,
            "melhorWpm": 41
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a conta ainda não tem campanha"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "Médias só das sessões concluídas, inteiras; null sem nenhuma (nunca 0). melhorWpm considera todas as sessões.",
    "notas": ""
  },
  "solo.estatisticas": {
    "grupo": "Solo",
    "metodo": "GET",
    "caminho": "/solo/estatisticas",
    "query": [],
    "chamada": "api.solo.estatisticas",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "EstatisticasSolo",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "campanhaId": "camp-1",
            "licoesConcluidas": 5,
            "melhorWpm": 41,
            "melhorPrecisao": 96,
            "porLicao": [
              {
                "exerciseId": "solo-015",
                "titulo": "Lição 15 — Vocabulário real",
                "nivel": 3,
                "tentativas": 2,
                "melhorWpm": 41,
                "melhorPrecisao": 92,
                "ultimaVez": "2026-10-02T21:10:00.000Z"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a conta ainda não tem campanha"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "licoesConcluidas = lições DISTINTAS com sessão concluída; o agregado por lição (tentativas, melhores marcas, última vez) com o JOIN em ExerciciosSolo para título e nível. Lição nunca tentada não aparece.",
    "notas": "Nível e XP não vêm aqui (são de /solo/campanha). Sequência de dias e evolução a tela deriva das datas e dos PPM do histórico."
  },
  "turmas.listar": {
    "grupo": "Turmas (professor)",
    "metodo": "GET",
    "caminho": "/turmas",
    "query": [],
    "chamada": "api.turmas.listar",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Turma[] — só as com ativa = true, array puro (lista curta)",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "id": "turma-1",
              "professorId": "u-2",
              "nome": "9º Ano A — Manhã",
              "totalAlunos": 4,
              "totalExercicios": 3,
              "convitesPendentes": 0,
              "periodo": "2026 · 1º semestre",
              "capaSemente": 7001,
              "ativa": true,
              "dataCriacao": "2026-02-01"
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token: WHERE ProfessorID = conta do token.",
    "regras": "totalAlunos (COUNT em ClassMembers com Status = 'ativo'), totalExercicios (COUNT em AtribuicoesProf) e convitesPendentes (COUNT com Status = 'convidado'). O filtro é Turmas.Ativa. O texto de `periodo` vem pronto. A tela não soma nada por turma.",
    "notas": ""
  },
  "turmas.listarArquivadas": {
    "grupo": "Turmas (professor)",
    "metodo": "GET",
    "caminho": "/turmas",
    "query": [
      "ativa"
    ],
    "chamada": "api.turmas.listarArquivadas",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Turma[] — só as arquivadas (Turmas.Ativa = false), mesma forma de item de GET /turmas",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "id": "turma-8",
              "professorId": "u-2",
              "nome": "8º Ano B — 2025",
              "totalAlunos": 0,
              "totalExercicios": 0,
              "convitesPendentes": 0,
              "periodo": "2025 · 2º semestre",
              "capaSemente": 7823,
              "ativa": false,
              "dataCriacao": "2025-08-04"
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token, como em GET /turmas.",
    "regras": "",
    "notas": "É a mesma rota de listar(); só o filtro muda. Serve ao \"Mostrar arquivadas\" da tela de turmas."
  },
  "turmas.criar": {
    "grupo": "Turmas (professor)",
    "metodo": "POST",
    "caminho": "/turmas",
    "query": [],
    "chamada": "api.turmas.criar",
    "corpo": {
      "descricao": "{ nome } — 3 a 100 caracteres",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "nome": "7º Ano C — Tarde"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Turma — já na forma de um item de GET /turmas",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-9",
            "professorId": "u-2",
            "nome": "7º Ano C — Tarde",
            "totalAlunos": 0,
            "totalExercicios": 0,
            "convitesPendentes": 0,
            "ativa": true,
            "dataCriacao": "2026-10-03"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "nome fora de 3 a 100 caracteres"
      },
      {
        "status": 409,
        "codigo": null,
        "quando": "a conta já tem uma turma com esse nome"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token vira o ProfessorID. Não aceita professorId no corpo.",
    "regras": "Nasce com Ativa = true. O período, se houver, é o back que monta.",
    "notas": "ClassesProf.Ano e Semestre existem desde a v7, mas esta rota não os recebe (ver @nao-usado no topo): a turma nasce com os dois NULL e sem `periodo`. O mock ainda não valida o nome no POST (só no PATCH); a tela valida antes."
  },
  "turmas.obter": {
    "grupo": "Turmas (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id",
    "query": [],
    "chamada": "api.turmas.obter",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "TurmaDetalhe — a turma mais o PPM médio",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-1",
            "professorId": "u-2",
            "nome": "9º Ano A — Manhã",
            "totalAlunos": 4,
            "totalExercicios": 3,
            "periodo": "2026 · 1º semestre",
            "capaSemente": 7001,
            "ativa": true,
            "dataCriacao": "2026-02-01",
            "ppmMedio": 33.3
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "ppmMedio com 1 casa decimal, só dos alunos que treinaram (quem nunca treinou não entra); null se ninguém treinou.",
    "notas": ""
  },
  "turmas.renomear": {
    "grupo": "Turmas (professor)",
    "metodo": "PATCH",
    "caminho": "/turmas/:id",
    "query": [],
    "chamada": "api.turmas.renomear",
    "corpo": {
      "descricao": "{ nome } — renomear; só o campo enviado muda",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "nome": "9º Ano A — Manhã (2026)"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Turma — a turma como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-1",
            "professorId": "u-2",
            "nome": "9º Ano A — Manhã (2026)",
            "totalAlunos": 4,
            "totalExercicios": 3,
            "periodo": "2026 · 1º semestre",
            "capaSemente": 7001,
            "ativa": true,
            "dataCriacao": "2026-02-01"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "nome fora de 3 a 100 caracteres"
      },
      {
        "status": 409,
        "codigo": null,
        "quando": "a conta já tem uma turma com esse nome"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "",
    "notas": "PATCH porque só o campo enviado muda. A tela mantém as contagens que já tinha: o PATCH não as recalcula."
  },
  "turmas.trocarCapa": {
    "grupo": "Turmas (professor)",
    "metodo": "PATCH",
    "caminho": "/turmas/:id",
    "query": [],
    "chamada": "api.turmas.trocarCapa",
    "corpo": {
      "descricao": "{ capaSemente } — inteiro; troca o desenho da capa",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "capaSemente": 418207
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Turma — a turma como ficou (mesma forma do renomear)",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-1",
            "nome": "9º Ano A — Manhã",
            "capaSemente": 418207,
            "ativa": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "capaSemente não é inteiro"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Grava em Turmas.CapaSemente. Sem semente gravada, a tela deriva uma do id — por isso a coluna aceita NULL.",
    "notas": ""
  },
  "turmas.arquivar": {
    "grupo": "Turmas (professor)",
    "metodo": "PATCH",
    "caminho": "/turmas/:id",
    "query": [],
    "chamada": "api.turmas.arquivar",
    "corpo": {
      "descricao": "{ ativa: false } — arquivar",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "ativa": false
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Turma — a turma como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-3",
            "nome": "Projeto de Extensão 2025",
            "ativa": false
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "ativa não é booleano"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Grava Turmas.Ativa = false. A turma some de GET /turmas e o histórico de sessões fica intacto.",
    "notas": "Arquivar, e NÃO excluir: SessionsProf aponta para a turma com ON DELETE CASCADE, e apagar a turma apagaria o histórico de treino de todos os alunos dela. Por isso não existe DELETE /turmas/:id."
  },
  "turmas.desarquivar": {
    "grupo": "Turmas (professor)",
    "metodo": "PATCH",
    "caminho": "/turmas/:id",
    "query": [],
    "chamada": "api.turmas.desarquivar",
    "corpo": {
      "descricao": "{ ativa: true } — desarquivar",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "ativa": true
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Turma — a turma como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-8",
            "nome": "8º Ano B — 2025",
            "ativa": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "ativa não é booleano"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Grava Turmas.Ativa = true: a turma volta a GET /turmas como estava.",
    "notas": ""
  },
  "turmas.atribuicoes": {
    "grupo": "Turmas (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/atribuicoes",
    "query": [],
    "chamada": "api.turmas.atribuicoes",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "AtribuicaoProfessor[] — o que a turma recebeu, na ordem de atribuição",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "exercicioId": "ex-prof-1",
              "titulo": "Acentuação em foco",
              "dificuldade": "medio",
              "atribuidoEm": "2026-02-03",
              "concluidoPor": 3,
              "totalAlunos": 4
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "concluidoPor = alunos ATIVOS da turma com sessão concluída no exercício; totalAlunos = alunos ativos. A tela não conta.",
    "notas": "A visão do ALUNO sobre a mesma tabela é GET /aluno/salas/:id, e não traz contagem da turma: seria entregar o desempenho dos colegas."
  },
  "turmas.atribuir": {
    "grupo": "Turmas (professor)",
    "metodo": "POST",
    "caminho": "/turmas/:id/atribuicoes",
    "query": [],
    "chamada": "api.turmas.atribuir",
    "corpo": {
      "descricao": "{ exercicioIds } — vários de uma vez",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "exercicioIds": [
              "ex-prof-3",
              "ex-prof-4"
            ]
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Atribuicao[] — a lista crua de atribuições da turma, como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "exerciseId": "ex-prof-1",
              "atribuidoEm": "2026-02-03",
              "prazo": null
            },
            {
              "exerciseId": "ex-prof-3",
              "atribuidoEm": "2026-10-03",
              "prazo": null
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma ou algum exercício não é da conta"
      }
    ],
    "identidade": "O token: a turma E cada exercício têm de ser da conta.",
    "regras": "Confere todos os ids ANTES de gravar qualquer um (metade atribuída é pior que nada). Repetir um já atribuído não duplica: a chave de AtribuicoesProf é o par (ClassID, ExerciseID).",
    "notas": "A resposta não traz título nem concluidoPor: a tela relê GET /turmas/:id/atribuicoes depois."
  },
  "turmas.removerAtribuicao": {
    "grupo": "Turmas (professor)",
    "metodo": "DELETE",
    "caminho": "/turmas/:id/atribuicoes/:exercicioId",
    "query": [],
    "chamada": "api.turmas.removerAtribuicao",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma de outra conta, ou o exercício não está atribuído a ela"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "",
    "notas": "A atribuição não tem id próprio: a remoção é pelo PAR turma + exercício, a chave primária de AtribuicoesProf."
  },
  "alunos.daTurma": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/alunos",
    "query": [],
    "chamada": "api.alunos.daTurma",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "LinhaDaTurma[] — ativos primeiro, depois os convidados, cada um com o estado",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "estado": "ativo",
              "id": "RP2025043",
              "nome": "Ana Pires",
              "entrouEm": "2026-02-01",
              "totalSessoes": 12,
              "wpmMedio": 39,
              "precisaoMedia": 91,
              "ultimaAtividade": "2026-10-03T12:00:00.000Z"
            },
            {
              "estado": "convidado",
              "id": "RP2025047",
              "nome": null,
              "convidadoEm": "2026-10-01T12:00:00.000Z"
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Junta ClassMembers com Status = 'ativo' e 'convidado' (o 'recusado' não aparece). O nome é o da conta dona do RP (Alunos.UserID -> Users.Nome). Os agregados (totalSessoes, médias, última atividade) são do aluno no sistema todo e vêm prontos; quem nunca treinou vem com null, nunca 0. Convidado não traz número.",
    "notas": ""
  },
  "alunos.remover": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "DELETE",
    "caminho": "/turmas/:id/alunos/:rp",
    "query": [],
    "chamada": "api.alunos.remover",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma de outra conta, ou o RP não está ativo nela"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.",
    "regras": "Tira o aluno ativo da turma, e o histórico de sessões dele nesta turma vai junto. Para quem só foi convidado, é DELETE .../convites/:rp.",
    "notas": ""
  },
  "alunos.convidar": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "POST",
    "caminho": "/turmas/:id/convites",
    "query": [],
    "chamada": "api.alunos.convidar",
    "corpo": {
      "descricao": "{ rp } — de uma conta que já existe",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "rp": "RP2025001"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "ConvidadoDaTurma",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "estado": "convidado",
            "id": "RP2025001",
            "nome": "Leonardo",
            "convidadoEm": "2026-10-03T14:02:00.000Z"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "RP_INVALIDO",
        "quando": "fora do formato RP + 7 dígitos"
      },
      {
        "status": 400,
        "codigo": "CONVITE_PROPRIO",
        "quando": "o RP é o da própria conta do token"
      },
      {
        "status": 404,
        "codigo": "RP_NAO_ENCONTRADO",
        "quando": "nenhuma conta com esse RP"
      },
      {
        "status": 409,
        "codigo": "JA_NA_TURMA",
        "quando": "o RP já está ativo na turma"
      },
      {
        "status": 409,
        "codigo": "JA_CONVIDADO",
        "quando": "já foi convidado e ainda não respondeu"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Normaliza o RP (sem espaço, maiúsculo) e grava ClassMembers com Status = 'convidado' e Data_Convite = agora. Ninguém entra na turma sem aceitar: o professor não cria aluno nem vê senha.",
    "notas": ""
  },
  "alunos.convidarVarios": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "POST",
    "caminho": "/turmas/:id/convites/importar",
    "query": [],
    "chamada": "api.alunos.convidarVarios",
    "corpo": {
      "descricao": "{ rps } — o lote inteiro numa requisição",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "rps": [
              "RP2025001",
              "RP2025002",
              "RP2025043",
              "RP9999999"
            ]
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "ResultadoConvites — cada RP cai numa das três listas",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "convidados": [
              {
                "estado": "convidado",
                "id": "RP2025001",
                "nome": "Leonardo",
                "convidadoEm": "2026-10-03T14:02:00.000Z"
              }
            ],
            "jaEstavam": [
              {
                "rp": "RP2025043",
                "estado": "ativo"
              }
            ],
            "falhas": [
              {
                "rp": "RP9999999",
                "motivo": "Nenhuma conta com esse RP."
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Importação parcial é permitida. RP repetido na lista vira falha (\"RP repetido na lista\"); os outros motivos são os do convite um por um.",
    "notas": ""
  },
  "alunos.cancelarConvite": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "DELETE",
    "caminho": "/turmas/:id/convites/:rp",
    "query": [],
    "chamada": "api.alunos.cancelarConvite",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma de outra conta, ou não há convite pendente para esse RP"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.",
    "regras": "Apaga o convite ainda não respondido; ele some da lista do aluno.",
    "notas": ""
  },
  "alunos.desempenho": {
    "grupo": "Alunos e convites (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/alunos/:rp/desempenho",
    "query": [],
    "chamada": "api.alunos.desempenho",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "DesempenhoAluno — os agregados e as sessões do aluno NESTA turma",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "alunoId": "RP2025043",
            "totalSessoes": 2,
            "wpmMedio": 38,
            "precisaoMedia": 94,
            "sessoes": [
              {
                "id": "ses-1",
                "exerciseId": "ex-prof-1",
                "alunoId": "RP2025043",
                "wpm": 40,
                "precisao": 95,
                "tempoSegundos": 58,
                "acertos": 76,
                "erros": 4,
                "concluida": true,
                "data": "2026-02-18T14:10:00.000Z"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma de outra conta, ou o RP não está ativo nela"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.",
    "regras": "Só as sessões DESTA turma (e os agregados sobre elas): as das outras turmas do aluno são de outros professores, e este não pode vê-las.",
    "notas": "Nenhuma tela usa (o modal de relatórios usa GET /turmas/:id/alunos/:rp/sessoes)."
  },
  "relatorios.turma": {
    "grupo": "Relatórios (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/relatorio",
    "query": [],
    "chamada": "api.relatorios.turma",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "RelatorioTurma — as quatro métricas do topo",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "turmaId": "turma-1",
            "totalAlunos": 4,
            "alunosComSessao": 3,
            "alunosAtivos": 2,
            "wpmMedio": 33,
            "precisaoMedia": 87,
            "exerciciosConcluidos": 5
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "alunosAtivos = alunos que treinaram nos últimos 7 dias (a janela é do back); médias inteiras das sessões concluídas da turma, null sem amostra; exerciciosConcluidos = pares (aluno, exercício) concluídos (COUNT: zero é zero).",
    "notas": ""
  },
  "relatorios.porAluno": {
    "grupo": "Relatórios (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/relatorio/alunos",
    "query": [],
    "chamada": "api.relatorios.porAluno",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "RelatorioAluno[] — uma linha por aluno ATIVO, inclusive quem nunca treinou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "id": "RP2025049",
              "nome": "Marina Duarte Alves",
              "entrouEm": "2026-02-05",
              "totalSessoes": 2,
              "wpmMedio": 32,
              "precisaoMedia": 78,
              "ultimaAtividade": "2026-10-01T12:00:00.000Z",
              "exerciciosConcluidos": 2,
              "exerciciosAtribuidos": 3
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Agregados DESTA turma (só as sessões dela), diferentes dos de GET /turmas/:id/alunos, que são do sistema todo. Quem nunca treinou: totalSessoes 0 e médias null. exerciciosConcluidos = exercícios DISTINTOS concluídos.",
    "notas": ""
  },
  "relatorios.porExercicio": {
    "grupo": "Relatórios (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/relatorio/exercicios",
    "query": [],
    "chamada": "api.relatorios.porExercicio",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "RelatorioExercicio[] — uma linha por exercício ATRIBUÍDO; nada atribuído = []",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "exercicioId": "ex-prof-1",
              "titulo": "Acentuação em foco",
              "dificuldade": "medio",
              "atribuidoEm": "2026-02-03",
              "concluidoPor": 2,
              "totalAlunos": 4,
              "wpmMedio": 37,
              "precisaoMedia": 87,
              "estouraramTempo": 1
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma inexistente ou de outra conta"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta.",
    "regras": "Médias da turma no exercício (null enquanto ninguém concluiu); estouraramTempo = sessões não concluídas, e 0 sempre que o exercício não tem tempo limite.",
    "notas": ""
  },
  "relatorios.sessoesDoAluno": {
    "grupo": "Relatórios (professor)",
    "metodo": "GET",
    "caminho": "/turmas/:id/alunos/:rp/sessoes",
    "query": [],
    "chamada": "api.relatorios.sessoesDoAluno",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Paginado<SessaoDoAluno> — as sessões do aluno NESTA turma, da mais recente para a mais antiga",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "total": 2,
            "pagina": 1,
            "itens": [
              {
                "id": "ses-2",
                "exerciseId": "ex-prof-2",
                "alunoId": "RP2025043",
                "wpm": 36,
                "precisao": 92,
                "tempoSegundos": 61,
                "acertos": 80,
                "erros": 7,
                "concluida": true,
                "data": "2026-02-19T09:30:00.000Z",
                "tituloExercicio": "Números do cotidiano"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "turma de outra conta, ou o RP não está ativo nela (não lista vazia)"
      }
    ],
    "identidade": "O token: a turma tem de ser da conta (senão 404). O RP na URL é o aluno-ALVO — sobre quem a ação é —, e não quem pede: a identidade nunca sai dele. Por isso o RP na URL aqui é de propósito.",
    "regras": "A ordem (mais recente primeiro) é parte do contrato. O título vem do JOIN com ExerciciosProf; exercício excluído: null.",
    "notas": ""
  },
  "exercicios.listar": {
    "grupo": "Biblioteca de exercícios (professor)",
    "metodo": "GET",
    "caminho": "/exercicios",
    "query": [],
    "chamada": "api.exercicios.listar",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Paginado<Exercicio> — paginado no contrato; quem lê passa por desembrulhar()",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "total": 4,
            "pagina": 1,
            "itens": [
              {
                "id": "ex-prof-1",
                "professorId": "u-2",
                "titulo": "Acentuação em foco",
                "texto": "...",
                "dificuldade": "medio",
                "tempoLimiteSegundos": 120,
                "atribuidoA": 2
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token: WHERE ProfessorID = conta do token.",
    "regras": "atribuidoA = em quantas turmas está atribuído (COUNT em AtribuicoesProf). A tela não conta.",
    "notas": ""
  },
  "exercicios.obter": {
    "grupo": "Biblioteca de exercícios (professor)",
    "metodo": "GET",
    "caminho": "/exercicios/:id",
    "query": [
      "turma"
    ],
    "chamada": "api.exercicios.obter",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "ExercicioDetalhe — mesma forma de um item da listagem",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "ex-prof-1",
            "professorId": "u-2",
            "titulo": "Acentuação em foco",
            "texto": "...",
            "dificuldade": "medio",
            "tempoLimiteSegundos": 120,
            "atribuidoA": 2
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe, é de outra conta, ou (aluno) não está atribuído à turma dele"
      }
    ],
    "identidade": "Conta: o exercício tem de ser dela; ?turma= é ignorado. Aluno: ?turma= é a turma em que ele está treinando, e o exercício tem de estar atribuído a ela E ele tem de estar ativo nela.",
    "regras": "",
    "notas": "A mesma regra vale no POST /sessoes, para o aluno descobrir na ABERTURA do treino, e não depois de digitar o texto inteiro."
  },
  "exercicios.criar": {
    "grupo": "Biblioteca de exercícios (professor)",
    "metodo": "POST",
    "caminho": "/exercicios",
    "query": [],
    "chamada": "api.exercicios.criar",
    "corpo": {
      "descricao": "DadosExercicio — o formulário inteiro",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "titulo": "Pontuação e ritmo",
            "texto": "Vírgula, ponto; dois-pontos: ...",
            "dificuldade": "facil",
            "tempoLimiteSegundos": 0
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Exercicio",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "ex-prof-8",
            "professorId": "u-2",
            "titulo": "Pontuação e ritmo",
            "texto": "Vírgula, ponto; dois-pontos: ...",
            "dificuldade": "facil",
            "tempoLimiteSegundos": 0,
            "atribuidoA": 0
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de aluno"
      }
    ],
    "identidade": "O token vira o ProfessorID.",
    "regras": "",
    "notas": "tempoLimiteSegundos 0 = sem limite. A contagem de caracteres não tem coluna: a tela conta do texto."
  },
  "exercicios.atualizar": {
    "grupo": "Biblioteca de exercícios (professor)",
    "metodo": "PATCH",
    "caminho": "/exercicios/:id",
    "query": [],
    "chamada": "api.exercicios.atualizar",
    "corpo": {
      "descricao": "DadosExercicio — o formulário inteiro",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "titulo": "Pontuação e ritmo",
            "texto": "...",
            "dificuldade": "medio",
            "tempoLimiteSegundos": 90
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Exercicio — como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "ex-prof-2",
            "professorId": "u-2",
            "titulo": "Pontuação e ritmo",
            "texto": "...",
            "dificuldade": "medio",
            "tempoLimiteSegundos": 90,
            "atribuidoA": 2
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: o exercício tem de ser da conta.",
    "regras": "",
    "notas": ""
  },
  "exercicios.excluir": {
    "grupo": "Biblioteca de exercícios (professor)",
    "metodo": "DELETE",
    "caminho": "/exercicios/:id",
    "query": [],
    "chamada": "api.exercicios.excluir",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe ou é de outra conta"
      }
    ],
    "identidade": "O token: o exercício tem de ser da conta.",
    "regras": "DELETE de verdade: SessionsProf e AtribuicoesProf têm ON DELETE CASCADE, então ele sai de todas as turmas e leva junto as sessões dos alunos nele. A tela avisa antes de confirmar.",
    "notas": ""
  },
  "sessoes.registrar": {
    "grupo": "Sessões",
    "metodo": "POST",
    "caminho": "/sessoes",
    "query": [],
    "chamada": "api.sessoes.registrar",
    "corpo": {
      "descricao": "DadosSessaoTreino — o que o motor mediu, mais o exercício e a turma",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "exercicio_id": "ex-prof-7",
            "turma_id": "turma-1",
            "wpm": 42,
            "precisao": 94,
            "acertos": 141,
            "erros": 9,
            "tempo_gasto_segundos": 88,
            "concluida": true
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "RespostaSessaoEscola — a sessão gravada mais o recorde",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "ses-31",
            "exerciseId": "ex-prof-7",
            "alunoId": "RP2025043",
            "turmaId": "turma-1",
            "wpm": 42,
            "precisao": 94,
            "tempoSegundos": 88,
            "acertos": 141,
            "erros": 9,
            "concluida": true,
            "data": "2026-10-03T14:20:00.000Z",
            "recordePessoal": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta (o Solo grava em /solo/sessoes; a prévia do professor não grava)"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "exercício não atribuído à turma, ou o aluno não está ativo nela"
      }
    ],
    "identidade": "O token: o AlunoID sai dele, nunca do corpo.",
    "regras": "recordePessoal (PPM maior que o melhor anterior dele no exercício) e os agregados do aluno, que passam a contar esta sessão. PPM, precisão, acertos e erros vêm do motor da tela e são gravados como chegaram.",
    "notas": ""
  },
  "sessoes.obter": {
    "grupo": "Sessões",
    "metodo": "GET",
    "caminho": "/sessoes/:id",
    "query": [],
    "chamada": "api.sessoes.obter",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Sessao | SessaoSolo — a sessão gravada, com acertos e tempo",
      "exemplos": [
        {
          "rotulo": "Escola",
          "valor": {
            "id": "ses-17",
            "exerciseId": "ex-prof-3",
            "alunoId": "RP2025043",
            "turmaId": "turma-2",
            "wpm": 49,
            "precisao": 96,
            "tempoSegundos": 126,
            "acertos": 144,
            "erros": 6,
            "concluida": true,
            "data": "2026-10-03T12:00:00.000Z"
          }
        },
        {
          "rotulo": "Solo",
          "valor": {
            "id": "hs-10",
            "exerciseId": "solo-015",
            "wpm": 41,
            "precisao": 92,
            "tempoSegundos": 84,
            "acertos": 46,
            "erros": 4,
            "concluida": true,
            "xpGanho": 73,
            "data": "2026-10-02T21:10:00.000Z"
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não existe, ou é de outra pessoa (o mesmo 404)"
      }
    ],
    "identidade": "O token. Só o DONO lê: token de aluno lê só as sessões Escola dele (SessionsProf.AlunoID); token de conta lê só as sessões Solo da campanha dele (SessionsSolo da CampanhaID do token). Sessão de outra pessoa responde 404, nunca 403. É a rota do F5 da tela de resultado: sem esta regra, trocar o ?sessao= da URL mostraria o treino de outra pessoa.",
    "regras": "Procura em SessionsProf e depois em SessionsSolo.",
    "notas": "É o que a tela de resultado lê num F5. Os acertos voltam aqui para ela mostrar o mesmo número de antes, sem cálculo nenhum."
  },
  "escola.aluno.historico": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/aluno/historico",
    "query": [],
    "chamada": "api.escola.aluno.historico",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Paginado<SessaoDoHistorico> — todas as sessões dele, da mais recente para a mais antiga",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "total": 12,
            "pagina": 1,
            "itens": [
              {
                "id": "ses-17",
                "exerciseId": "ex-prof-3",
                "alunoId": "RP2025043",
                "turmaId": "turma-2",
                "wpm": 49,
                "precisao": 96,
                "tempoSegundos": 126,
                "acertos": 144,
                "erros": 6,
                "concluida": true,
                "data": "2026-10-03T12:00:00.000Z",
                "tituloExercicio": "Funções em JavaScript",
                "nomeTurma": "Reforço de digitação"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "O JOIN com o título do exercício e o nome da turma; a ordem é parte do contrato. Sem filtro por exercício: a tela filtra a própria lista.",
    "notas": ""
  },
  "escola.aluno.resumo": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/aluno/resumo",
    "query": [],
    "chamada": "api.escola.aluno.resumo",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "ResumoDoAluno — os números do topo do histórico",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "sessoesTotais": 12,
            "sessoesConcluidas": 11,
            "wpmMedio": 39,
            "precisaoMedia": 91,
            "melhorWpm": 49,
            "melhorPrecisao": 96,
            "diasSeguidos": 3
          }
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "Médias só das concluídas (null sem nenhuma); melhores marcas de todas as sessões; diasSeguidos terminando hoje ou ontem (senão 0). Nenhuma média de turma: o aluno não recebe número de colega.",
    "notas": ""
  },
  "escola.aluno.salas": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/aluno/salas",
    "query": [],
    "chamada": "api.escola.aluno.salas",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "SalaDoAluno[] — as turmas em que ele está ATIVO, com o progresso dele",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "id": "turma-1",
              "nome": "9º Ano A — Manhã",
              "professor": "Henrique Lima",
              "capaSemente": 7001,
              "totalAlunos": 4,
              "exerciciosFeitos": 2,
              "exerciciosTotal": 3
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "Só turmas com ClassMembers.Status = 'ativo' para ele e Turmas.Ativa = true. exerciciosFeitos = atribuídos com sessão dele (concluída ou tempo esgotado); totalAlunos = alunos ativos; professor = nome da conta dona.",
    "notas": ""
  },
  "escola.aluno.sala": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/aluno/salas/:turmaId",
    "query": [],
    "chamada": "api.escola.aluno.sala",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "SalaDetalhe — a sala e os exercícios dela, com o estado de cada um PARA ELE",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-1",
            "nome": "9º Ano A — Manhã",
            "professor": "Henrique Lima",
            "capaSemente": 7001,
            "totalAlunos": 4,
            "exerciciosFeitos": 2,
            "exerciciosTotal": 3,
            "lista": [
              {
                "id": "ex-prof-1",
                "titulo": "Acentuação em foco",
                "dificuldade": "medio",
                "caracteres": 247,
                "tempoLimiteSegundos": 120,
                "atribuidoEm": "2026-02-03",
                "prazo": null,
                "estado": "feito",
                "melhorWpm": 40,
                "melhorPrecisao": 95,
                "ultimaSessao": "2026-02-18T14:10:00.000Z"
              }
            ]
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a sala não existe ou ele não está nela"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. O :turmaId é da SALA, nunca de aluno.",
    "regras": "O estado de cada exercício para ele (nao_feito, feito, tempo_esgotado), a melhor marca dele e a contagem de caracteres (o texto não vem). Na ordem em que o professor atribuiu. Nenhum número de colega.",
    "notas": ""
  },
  "escola.aluno.convites": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/aluno/convites",
    "query": [],
    "chamada": "api.escola.aluno.convites",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "ConviteDoAluno[] — os que esperam resposta dele, o mais recente primeiro",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "turmaId": "turma-4",
              "nome": "7º Ano C — Tarde",
              "professor": "Henrique Lima",
              "totalAlunos": 2,
              "totalExercicios": 0,
              "convidadoEm": "2026-10-01T12:00:00.000Z"
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. Não recebe id.",
    "regras": "ClassMembers com Status = 'convidado' para o RP dele, só de turmas ativas; totalAlunos conta só os ativos.",
    "notas": ""
  },
  "escola.aluno.aceitarConvite": {
    "grupo": "Aluno",
    "metodo": "POST",
    "caminho": "/aluno/convites/:turmaId/aceitar",
    "query": [],
    "chamada": "api.escola.aluno.aceitarConvite",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "SalaDoAluno — a sala, pronta para entrar na grade",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": "turma-4",
            "nome": "7º Ano C — Tarde",
            "professor": "Henrique Lima",
            "capaSemente": 7412,
            "totalAlunos": 3,
            "exerciciosFeitos": 0,
            "exerciciosTotal": 0
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não há convite pendente dele para a turma (cancelado, já respondido, nunca existiu)"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token: só vale o convite que é DELE.",
    "regras": "Grava ClassMembers.Status = 'ativo' e preenche ClassMembers.Data_Matricula com a data de agora: na v6 ela é a data em que o ALUNO aceitou, e era NULL até aqui.",
    "notas": ""
  },
  "escola.aluno.recusarConvite": {
    "grupo": "Aluno",
    "metodo": "POST",
    "caminho": "/aluno/convites/:turmaId/recusar",
    "query": [],
    "chamada": "api.escola.aluno.recusarConvite",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "não há convite pendente dele para a turma"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token: só vale o convite que é DELE.",
    "regras": "Grava ClassMembers.Status = 'recusado'. Não tem volta pelo lado dele: só o professor pode mandar outro convite.",
    "notas": ""
  },
  "escola.aluno.desempenhoNaTurma": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/turmas/:turmaId/meu-desempenho",
    "query": [],
    "chamada": "api.escola.aluno.desempenhoNaTurma",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "DesempenhoNaTurma — o relatório individual dele NA sala",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "sessoesConcluidas": 9,
            "licoes": 2,
            "diasSeguidos": 3,
            "minhaMedia": {
              "velocidade": 40,
              "precisao": 90
            },
            "mediaSala": {
              "velocidade": 43,
              "precisao": 92
            }
          }
        },
        {
          "rotulo": "Abaixo de 3 sessões concluídas",
          "valor": {
            "sessoesConcluidas": 2,
            "licoes": 2,
            "diasSeguidos": 0,
            "minhaMedia": null,
            "mediaSala": null
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a turma não existe ou ele não está nela"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token. O :turmaId é da turma, nunca de aluno.",
    "regras": "Tudo sobre as sessões DESTA turma: sessoesConcluidas; licoes (exercícios distintos concluídos); diasSeguidos; minhaMedia (PPM e precisão médios dele, inteiros) e mediaSala (das sessões concluídas de todos os alunos ativos). Com menos de 3 sessões concluídas, as duas médias vêm null. A tela não calcula média.",
    "notas": ""
  },
  "escola.aluno.rankingDaTurma": {
    "grupo": "Aluno",
    "metodo": "GET",
    "caminho": "/turmas/:turmaId/ranking",
    "query": [],
    "chamada": "api.escola.aluno.rankingDaTurma",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "LinhaDoRanking[] — JÁ ORDENADO E PONTUADO; a tela só exibe",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "posicao": 1,
              "nome": "Bruno Sato",
              "voce": false,
              "licoes": 2,
              "ritmo": 46,
              "diasSeguidos": 12,
              "pontos": 146
            },
            {
              "posicao": 4,
              "nome": null,
              "voce": false,
              "licoes": 2,
              "ritmo": 42,
              "diasSeguidos": 8,
              "pontos": 122
            },
            {
              "posicao": 6,
              "nome": "Ana Pires",
              "voce": true,
              "licoes": 2,
              "ritmo": 40,
              "diasSeguidos": 3,
              "pontos": 95
            }
          ]
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a turma não existe ou ele não está nela"
      },
      {
        "status": 403,
        "codigo": "TIPO_INVALIDO",
        "quando": "token de conta"
      }
    ],
    "identidade": "O token marca a linha `voce`. O :turmaId é da turma.",
    "regras": "A ANONIMIZAÇÃO É DO BACK: do 4º lugar em diante, nome = null — menos na linha dele, que vem sempre com o nome. O nome dos colegas não pode chegar ao navegador, nem escondido. Sem nome no cadastro, vai o RP; nunca um nome inventado. Para cada aluno ATIVO, só com as sessões DESTA turma (SessionsProf):\n\n```\nlicoes        exercícios DIFERENTES com sessão concluída\n              (COUNT DISTINCT ExercicioID WHERE concluida = 1)\nritmo         PPM médio das concluídas, inteiro; null sem nenhuma\ndiasSeguidos  dias de calendário seguidos com sessão (concluída\n              ou não), terminando HOJE ou ONTEM; senão 0\npontos = licoes * 20 + (ritmo ?? 0) + diasSeguidos * 5\n```\n\nOrdem: pontos desc; empate, mais lições; depois mais dias. posicao começa em 1.",
    "notas": "Lição pesa mais que tudo: quem fez mais exercícios fica na frente de quem só digita rápido; o ritmo entra a 1 ponto por PPM e cada dia seguido vale 5, para a constância contar. Nunca é velocidade pura."
  },
  "admin.categorias": {
    "grupo": "Administração",
    "metodo": "GET",
    "caminho": "/categorias",
    "query": [],
    "chamada": "api.admin.categorias",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Categoria[] — só as ativas",
      "exemplos": [
        {
          "rotulo": "",
          "valor": [
            {
              "id": 1,
              "nome": "Palavras comuns",
              "ativo": true
            }
          ]
        }
      ]
    },
    "erros": [],
    "identidade": "Qualquer token válido: ler a lista não exige papel.",
    "regras": "",
    "notas": ""
  },
  "admin.criarCategoria": {
    "grupo": "Administração",
    "metodo": "POST",
    "caminho": "/categorias",
    "query": [],
    "chamada": "api.admin.criarCategoria",
    "corpo": {
      "descricao": "{ nome }",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "nome": "Atalhos de teclado"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Categoria",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": 6,
            "nome": "Atalhos de teclado",
            "ativo": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 400,
        "codigo": "DADOS_INVALIDOS",
        "quando": "nome vazio"
      },
      {
        "status": 409,
        "codigo": "CATEGORIA_DUPLICADA",
        "quando": "já existe uma ativa com esse nome (sem diferenciar maiúscula)"
      },
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "o token não é de administrador"
      }
    ],
    "identidade": "O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse (ver a pendência do papel de administrador, no topo).",
    "regras": "",
    "notas": ""
  },
  "admin.renomearCategoria": {
    "grupo": "Administração",
    "metodo": "PATCH",
    "caminho": "/categorias/:id",
    "query": [],
    "chamada": "api.admin.renomearCategoria",
    "corpo": {
      "descricao": "{ nome }",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "nome": "Palavras do dia a dia"
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Categoria",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "id": 1,
            "nome": "Palavras do dia a dia",
            "ativo": true
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a categoria não existe, ou o token não é de administrador"
      }
    ],
    "identidade": "O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.",
    "regras": "",
    "notas": ""
  },
  "admin.apagarCategoria": {
    "grupo": "Administração",
    "metodo": "DELETE",
    "caminho": "/categorias/:id",
    "query": [],
    "chamada": "api.admin.apagarCategoria",
    "corpo": null,
    "resposta": {
      "status": 204,
      "descricao": "(sem corpo)",
      "exemplos": []
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "a categoria não existe, ou o token não é de administrador"
      },
      {
        "status": 409,
        "codigo": "CATEGORIA_EM_USO",
        "quando": "algum exercício ativo usa a categoria"
      }
    ],
    "identidade": "O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.",
    "regras": "Exclusão LÓGICA (ativo = false).",
    "notas": ""
  },
  "admin.parametros": {
    "grupo": "Administração",
    "metodo": "GET",
    "caminho": "/parametros",
    "query": [],
    "chamada": "api.admin.parametros",
    "corpo": null,
    "resposta": {
      "status": 200,
      "descricao": "Parametros — a tabela Configuracoes",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "wpmMeta": 40,
            "precisaoMinima": 90,
            "tempoLimitePadrao": 60,
            "xpPorNivel": 200
          }
        }
      ]
    },
    "erros": [],
    "identidade": "Qualquer token válido: o lobby do Solo lê o xpPorNivel.",
    "regras": "",
    "notas": ""
  },
  "admin.salvarParametros": {
    "grupo": "Administração",
    "metodo": "PUT",
    "caminho": "/parametros",
    "query": [],
    "chamada": "api.admin.salvarParametros",
    "corpo": {
      "descricao": "Partial<Parametros> — só os campos que mudam",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "wpmMeta": 45
          }
        }
      ]
    },
    "resposta": {
      "status": 200,
      "descricao": "Parametros — como ficou",
      "exemplos": [
        {
          "rotulo": "",
          "valor": {
            "wpmMeta": 45,
            "precisaoMinima": 90,
            "tempoLimitePadrao": 60,
            "xpPorNivel": 200
          }
        }
      ]
    },
    "erros": [
      {
        "status": 404,
        "codigo": "NAO_ENCONTRADO",
        "quando": "o token não é de administrador"
      }
    ],
    "identidade": "O token, que tem de ser de ADMINISTRADOR. Conta comum ou aluno: 404, como se a rota não existisse.",
    "regras": "",
    "notas": ""
  }
};
