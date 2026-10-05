-- ==========================================
-- TECLAR - DB_Teclar_v7.sql
-- Base: v6 inteiro (Alunos.UserID, ClassMembers.Status e Data_Convite).
-- Continua SEM MatriculasProf e SEM Users.Perfil.
-- Os ON DELETE sao os do v6: o front assume esse comportamento de exclusao.
--
-- O que mudou em relacao a v6, e por que:
--
-- Trazido do DB_Teclar_corrigido.sql:
--  1. CREATE DATABASE com utf8mb4 / utf8mb4_unicode_ci: nome de turma,
--     titulo e texto de exercicio tem acento e travessao.
--  2. Tabelas Categorias e Configuracoes, com os dados iniciais: o grupo
--     Administracao do contrato (/categorias e /parametros) le e grava nelas.
--  3. ExerciciosSolo.CategoriaID, NivelMinimo e XPConcessao.
--  4. ExerciciosProf.CategoriaID.
--  5. SessionsSolo.XPGanho (o "xpGanho" do historico Solo) e WPM DECIMAL(5,2).
--  6. SessionsProf.WPM DECIMAL(5,2): INT perdia a casa decimal.
--  7. CampanhasSolo.Data_Criacao e Ativo.
--  8. Alunos.Data_Cadastro e Ativo: o login de aluno responde CONTA_INATIVA.
--  9. Os tres indices de sessao (historico por campanha, por aluno, por turma).
-- 10. AtribuicoesProf.Prazo: o "prazo" da atribuicao e da sala do aluno.
--
-- Novo (nao estava em nenhum dos dois):
-- 11. ClassesProf.Ativa: arquivar/desarquivar turma (PATCH /turmas/:id).
--     Substitui o Status ENUM('Ativa','Encerrada') do corrigido, que NAO
--     entrou: seriam dois conceitos para o mesmo estado.
--     ClassesProf.CapaSemente, INT NULL: a semente do desenho da capa.
--     NULL = a tela deriva uma do id da turma (e o que o contrato diz).
-- 12. ClassesProf.Ano e Semestre, NULL: turma existente nao tem esses dados.
-- 13. ClassesProf.Data_Criacao: o "dataCriacao" de toda resposta de /turmas.
--
-- Mudado em coluna que ja existia:
-- 14. ClassMembers.Data_Matricula perde o DEFAULT CURRENT_TIMESTAMP e fica
--     NULL. Ela e a data do ACEITE do convite: com o DEFAULT, a linha do
--     convite nascia com a data preenchida, e o certo dependia de o back
--     lembrar de gravar NULL.
-- 15. Categorias.Nome sem UNIQUE (o corrigido tinha). A exclusao e logica,
--     e o nome so nao pode repetir entre as ATIVAS; o UNIQUE barrava
--     recriar o nome de uma categoria apagada. Quem garante e o back
--     (409 CATEGORIA_DUPLICADA no contrato).
--
-- As FKs de CategoriaID sao novas (nao existiam no v6) e usam
-- ON DELETE SET NULL, como no corrigido. Na pratica a categoria nunca e
-- apagada de verdade: DELETE /categorias e exclusao logica (Ativo = FALSE).
-- ==========================================

CREATE DATABASE IF NOT EXISTS teclarDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE teclarDB;

-- ==========================================
-- 1. CONTAS
-- ==========================================

-- Conta unica. NAO existe coluna de perfil: o universo (Solo ou Professor)
-- e escolhido depois do login e pode mudar a qualquer momento.
-- A mesma conta pode ter campanha no Solo E turmas como professor.
CREATE TABLE Users (
    ID VARCHAR(100) PRIMARY KEY,
    Nome VARCHAR(150) NOT NULL,
    Email VARCHAR(150) UNIQUE NOT NULL,
    GoogleID VARCHAR(100) UNIQUE NULL,         -- sub da conta Google | NULL = entrou por senha
    SenhaHash VARCHAR(255) NULL,               -- NULL = entrou por Google
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,

    -- garante que a conta tem pelo menos uma forma de entrar
    CONSTRAINT chk_users_login CHECK (GoogleID IS NOT NULL OR SenhaHash IS NOT NULL)
);

-- O ID do aluno e o RP ("RP" + 7 digitos), gerado pelo BACK no cadastro
-- da conta. Quem cria conta ganha, na mesma hora, um RP e uma senha de
-- aluno. Alunos aponta para a conta dona: e dela que vem o Nome.
-- Nome continua NULL para aluno antigo, sem conta ligada.
-- v7: Data_Cadastro e Ativo.
CREATE TABLE Alunos (
    ID VARCHAR(100) PRIMARY KEY,           -- o RP: RP + 7 digitos
    UserID VARCHAR(100) NULL,              -- a conta dona; NULL = aluno antigo
    Nome VARCHAR(150) NULL,
    SenhaHash VARCHAR(255) NOT NULL,       -- senha de aluno, gerada pelo sistema
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_aluno_user FOREIGN KEY (UserID)
        REFERENCES Users(ID) ON DELETE CASCADE
);

-- v7: categorias de exercicio. Exclusao e logica (Ativo = FALSE).
CREATE TABLE Categorias (
    ID    INT AUTO_INCREMENT PRIMARY KEY,
    -- Sem UNIQUE de proposito: o nome so nao pode repetir entre as
    -- categorias ATIVAS, e uma apagada (Ativo = FALSE) pode ter o nome
    -- reusado. O banco nao expressa "unico entre as ativas"; o back
    -- confere antes de gravar (409 CATEGORIA_DUPLICADA).
    Nome  VARCHAR(50) NOT NULL,
    Ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- v7: parametros do sistema (GET/PUT /parametros)
CREATE TABLE Configuracoes (
    Chave     VARCHAR(50) PRIMARY KEY,
    Valor     VARCHAR(255) NOT NULL,
    Descricao VARCHAR(255)
);

-- ==========================================
-- 2. UNIVERSO SOLO
-- ==========================================

-- Gerencia o "Save" e a gamificacao do jogador adulto
-- v7: Data_Criacao e Ativo.
CREATE TABLE CampanhasSolo (
    CampanhaID VARCHAR(100) PRIMARY KEY,
    JogadorID VARCHAR(100) NOT NULL,
    NivelAtual INT DEFAULT 1,
    XPTotal INT DEFAULT 0,
    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (JogadorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- As 76 licoes do professor vem em 10 niveis pedagogicos, com numero de
-- repeticoes por licao e uma sequencia fixa.
-- v7: CategoriaID, NivelMinimo e XPConcessao.
CREATE TABLE ExerciciosSolo (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    CategoriaID INT NULL,
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,       -- 0 = sem limite
    Nivel       INT NOT NULL DEFAULT 1,        -- 1 a 10 (dificuldade pedagogica)
    Repeticoes  INT NOT NULL DEFAULT 1,        -- quantas vezes a licao se repete
    Ordem       INT NOT NULL DEFAULT 0,        -- sequencia na campanha (1 a 76)
    NivelMinimo INT NOT NULL DEFAULT 1,        -- nivel da campanha que desbloqueia
    XPConcessao INT NOT NULL DEFAULT 10,       -- XP base da licao
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,

    INDEX idx_solo_ordem (Ordem),
    FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL
);

-- Sessoes de jogo vinculadas diretamente a campanha do usuario
-- v7: WPM DECIMAL(5,2) e XPGanho.
CREATE TABLE SessionsSolo (
    ID VARCHAR(100) PRIMARY KEY,
    CampanhaID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    WPM DECIMAL(5,2),
    Precisao DECIMAL(5,2),
    Acertos INT,
    Erros INT,
    Tempo_Gasto_Segundos INT,
    Concluida BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE = terminou o texto | FALSE = estourou o tempo
    XPGanho INT NOT NULL DEFAULT 0,            -- quanto essa sessao rendeu
    Data_Sessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CampanhaID) REFERENCES CampanhasSolo(CampanhaID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosSolo(ExerciseID) ON DELETE CASCADE
);

-- ==========================================
-- 3. UNIVERSO PROFESSOR E ALUNOS
-- ==========================================

-- v7: Ativa, CapaSemente, Ano, Semestre e Data_Criacao.
-- Ativa = FALSE e turma arquivada: some de GET /turmas, o historico fica.
-- E o unico estado da turma: nao existe Status 'Encerrada' a parte.
-- Ano e Semestre sao NULL porque turma existente nao tem esses dados.
CREATE TABLE ClassesProf (
    ClassID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    NomeTurma VARCHAR(100),
    Ano INT NULL,
    Semestre INT NULL,
    Ativa BOOLEAN NOT NULL DEFAULT TRUE,
    CapaSemente INT NULL,                      -- semente da capa; NULL = a tela deriva do id
    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- O professor CONVIDA pelo RP exato. Uma linha aqui guarda o estado do
-- convite. Contagem de alunos, medias e relatorios usam WHERE Status = 'ativo'.
CREATE TABLE ClassMembers (
    ID  VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'ativo',   -- convidado | ativo | recusado
    Data_Convite DATETIME NULL,                    -- quando o professor convidou
    Data_Matricula DATETIME NULL,                  -- quando o aluno aceitou; NULL enquanto convidado

    PRIMARY KEY (ID, ClassID),
    INDEX idx_membro_status (ClassID, Status),

    FOREIGN KEY (ID)  REFERENCES Alunos(ID)   ON DELETE CASCADE,
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
);

-- O exercicio pertence ao PROFESSOR, nao a uma turma.
-- Assim ele existe uma vez so e vai para quantas turmas quiser.
-- v7: CategoriaID.
CREATE TABLE ExerciciosProf (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    CategoriaID INT NULL,
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,       -- 0 = sem limite
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE CASCADE,
    FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL
);

-- Qual exercicio foi atribuido a qual turma
-- v7: Prazo.
CREATE TABLE AtribuicoesProf (
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Data_Atribuicao DATETIME DEFAULT CURRENT_TIMESTAMP,
    Prazo DATETIME NULL,                       -- data de entrega; NULL = sem prazo

    PRIMARY KEY (ClassID, ExerciseID),
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE CASCADE
);

-- Sessao do ALUNO: o que ele fez em cada exercicio atribuido.
-- E esta a tabela que guarda o desempenho do aluno.
-- v7: WPM DECIMAL(5,2).
CREATE TABLE SessionsProf (
    ID VARCHAR(100) PRIMARY KEY,
    AlunoID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    WPM DECIMAL(5,2),
    Precisao DECIMAL(5,2),
    Acertos INT,
    Erros INT,
    Tempo_Gasto_Segundos INT,
    Concluida BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE = terminou o texto | FALSE = estourou o tempo
    Data_Sessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (AlunoID) REFERENCES Alunos(ID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE CASCADE,
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
);

-- ==========================================
-- 4. INDICES
-- As consultas mais pesadas do sistema saem daqui.
-- ==========================================
CREATE INDEX idx_sessoes_solo_campanha ON SessionsSolo(CampanhaID, Data_Sessao);
CREATE INDEX idx_sessoes_prof_aluno    ON SessionsProf(AlunoID, Data_Sessao);
CREATE INDEX idx_sessoes_prof_turma    ON SessionsProf(ClassID, Data_Sessao);

-- ==========================================
-- 5. DADOS INICIAIS
-- ==========================================
INSERT INTO Categorias (Nome) VALUES
    ('Textos gerais'),
    ('Programacao'),
    ('Ortografia'),
    ('Numeros e simbolos'),
    ('Literatura');

INSERT INTO Configuracoes (Chave, Valor, Descricao) VALUES
    ('wpm_meta_padrao',              '40',  'Meta de palavras por minuto'),
    ('precisao_minima',              '90',  'Precisao minima em porcentagem'),
    ('tempo_limite_padrao_segundos', '60',  'Tempo limite padrao de um exercicio'),
    ('xp_por_nivel',                 '100', 'XP necessario para subir de nivel');


-- ==========================================
-- Se o banco ja existe, use isto em vez de recriar:
-- ==========================================
-- ALTER TABLE Users DROP COLUMN Perfil;
-- ALTER TABLE Alunos ADD Nome VARCHAR(150) NULL AFTER ID;
-- ALTER TABLE ExerciciosSolo ADD Nivel INT NOT NULL DEFAULT 1 AFTER Tempo_Limite_Segundos;
-- ALTER TABLE ExerciciosSolo ADD Repeticoes INT NOT NULL DEFAULT 1 AFTER Nivel;
-- ALTER TABLE ExerciciosSolo ADD Ordem INT NOT NULL DEFAULT 0 AFTER Repeticoes;
-- ALTER TABLE ExerciciosSolo ADD INDEX idx_solo_ordem (Ordem);
--
-- v6 (RP e convites):
-- ALTER TABLE Alunos ADD UserID VARCHAR(100) NULL AFTER ID;
-- ALTER TABLE Alunos ADD CONSTRAINT fk_aluno_user
--     FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE;
-- ALTER TABLE ClassMembers ADD Status VARCHAR(20) NOT NULL DEFAULT 'ativo' AFTER ClassID;
-- ALTER TABLE ClassMembers ADD Data_Convite DATETIME NULL AFTER Status;
-- ALTER TABLE ClassMembers ADD INDEX idx_membro_status (ClassID, Status);
--
-- Atencao: quem ja tem linha em ClassMembers fica como 'ativo' pelo DEFAULT,
-- que e o comportamento certo (ja estava na turma antes de existir convite).
--
-- v7 (categorias, configuracoes, XP, arquivar turma, capa, prazo):
-- ALTER DATABASE teclarDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--
-- CREATE TABLE Categorias (
--     ID    INT AUTO_INCREMENT PRIMARY KEY,
--     Nome  VARCHAR(50) NOT NULL,          -- sem UNIQUE: ver a tabela acima
--     Ativo BOOLEAN NOT NULL DEFAULT TRUE
-- );
-- CREATE TABLE Configuracoes (
--     Chave     VARCHAR(50) PRIMARY KEY,
--     Valor     VARCHAR(255) NOT NULL,
--     Descricao VARCHAR(255)
-- );
-- (depois, os dois INSERT da secao 5)
--
-- ALTER TABLE Alunos ADD Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER SenhaHash;
-- ALTER TABLE Alunos ADD Ativo BOOLEAN DEFAULT TRUE AFTER Data_Cadastro;
--
-- ALTER TABLE CampanhasSolo ADD Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER XPTotal;
-- ALTER TABLE CampanhasSolo ADD Ativo BOOLEAN DEFAULT TRUE AFTER Data_Criacao;
--
-- ALTER TABLE ExerciciosSolo ADD CategoriaID INT NULL AFTER ExerciseID;
-- ALTER TABLE ExerciciosSolo ADD NivelMinimo INT NOT NULL DEFAULT 1 AFTER Ordem;
-- ALTER TABLE ExerciciosSolo ADD XPConcessao INT NOT NULL DEFAULT 10 AFTER NivelMinimo;
-- ALTER TABLE ExerciciosSolo ADD CONSTRAINT fk_solo_categoria
--     FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL;
--
-- ALTER TABLE SessionsSolo MODIFY WPM DECIMAL(5,2);
-- ALTER TABLE SessionsSolo ADD XPGanho INT NOT NULL DEFAULT 0 AFTER Concluida;
--
-- ALTER TABLE ClassesProf ADD Ano INT NULL AFTER NomeTurma;
-- ALTER TABLE ClassesProf ADD Semestre INT NULL AFTER Ano;
-- ALTER TABLE ClassesProf ADD Ativa BOOLEAN NOT NULL DEFAULT TRUE AFTER Semestre;
-- ALTER TABLE ClassesProf ADD CapaSemente INT NULL AFTER Ativa;
-- ALTER TABLE ClassesProf ADD Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER CapaSemente;
--
-- ALTER TABLE ClassMembers MODIFY Data_Matricula DATETIME NULL DEFAULT NULL;
-- UPDATE ClassMembers SET Data_Matricula = NULL WHERE Status <> 'ativo';
--
-- ALTER TABLE ExerciciosProf ADD CategoriaID INT NULL AFTER ProfessorID;
-- ALTER TABLE ExerciciosProf ADD CONSTRAINT fk_prof_categoria
--     FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL;
--
-- ALTER TABLE AtribuicoesProf ADD Prazo DATETIME NULL AFTER Data_Atribuicao;
--
-- ALTER TABLE SessionsProf MODIFY WPM DECIMAL(5,2);
--
-- CREATE INDEX idx_sessoes_solo_campanha ON SessionsSolo(CampanhaID, Data_Sessao);
-- CREATE INDEX idx_sessoes_prof_aluno    ON SessionsProf(AlunoID, Data_Sessao);
-- CREATE INDEX idx_sessoes_prof_turma    ON SessionsProf(ClassID, Data_Sessao);
--
-- Atencao: o ALTER DATABASE so muda o padrao das tabelas NOVAS. Tabela que
-- ja existe continua no charset antigo ate um
--     ALTER TABLE <tabela> CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Turma existente fica com Ativa = TRUE (o certo: nenhuma foi arquivada
-- antes de a coluna existir), Ano, Semestre e CapaSemente NULL (a capa e
-- derivada do id, como antes). Data_Criacao recebe a hora do ALTER, nao a
-- data real de criacao, que o banco nunca guardou.
-- O MODIFY de Data_Matricula nao mexe nas linhas ativas. O UPDATE limpa a
-- data que o DEFAULT antigo carimbou nos convites ainda nao aceitos (e nos
-- recusados, que tambem nunca aceitaram).
