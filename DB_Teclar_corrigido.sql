-- =====================================================
-- TECLAR - DB_Teclar.sql (corrigido)
-- Mantida a arquitetura de dois mundos (Solo / Professor).
-- Alteracoes marcadas com [ERRO], [NOVO] ou [MUDOU].
-- =====================================================

-- [ERRO] faltava o ponto e virgula, o USE colava na linha de cima
CREATE DATABASE IF NOT EXISTS teclarDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE teclarDB;


-- =====================================================
-- 1. NUCLEO
-- =====================================================

-- Professores e jogadores solo (login pelo Google)
CREATE TABLE Users (
    ID            VARCHAR(100) PRIMARY KEY,
    Nome          VARCHAR(150) NOT NULL,
    Email         VARCHAR(150) UNIQUE NOT NULL,

    -- [MUDOU] era NOT NULL. Login e pelo Google, nao existe senha local.
    -- Fica nulavel caso mais pra frente entre login por senha.
    SenhaHash     VARCHAR(255) NULL,

    -- [NOVO] sem isso o login nao sabe se manda pro dashboard
    -- do professor ou pro lobby de campanhas
    Perfil        ENUM('Individual','Professor') NOT NULL,

    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo         BOOLEAN DEFAULT TRUE
);
-- [ERRO] esta tabela nunca era fechada. Faltava o ");" e por causa
-- disso todo o resto do arquivo quebrava.


-- Alunos (login por ID / matricula)
CREATE TABLE Alunos (
    ID            VARCHAR(100) PRIMARY KEY,

    -- [NOVO] sem Nome o relatorio do professor mostra so numero de matricula
    Nome          VARCHAR(150) NOT NULL,

    SenhaHash     VARCHAR(255) NOT NULL,
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo         BOOLEAN DEFAULT TRUE          -- [NOVO]
);


-- Categorias  [NOVO]
-- Sem tabela o modulo de administracao nao tem CRUD.
CREATE TABLE Categorias (
    ID    INT AUTO_INCREMENT PRIMARY KEY,
    Nome  VARCHAR(50) NOT NULL UNIQUE,
    Ativo BOOLEAN NOT NULL DEFAULT TRUE
);


-- Parametros do sistema  [NOVO]
CREATE TABLE Configuracoes (
    Chave     VARCHAR(50) PRIMARY KEY,
    Valor     VARCHAR(255) NOT NULL,
    Descricao VARCHAR(255)
);


-- =====================================================
-- 2. MUNDO SOLO
-- =====================================================

CREATE TABLE CampanhasSolo (
    CampanhaID     VARCHAR(100) PRIMARY KEY,
    JogadorID      VARCHAR(100) NOT NULL,

    -- [NOVO] o fluxo fala em "nome do personagem" e "avatar do jogador"
    -- nos cards do lobby. Nao existia coluna nenhuma pra isso.
    NomePersonagem VARCHAR(50) NOT NULL,
    Avatar         VARCHAR(100),

    NivelAtual     INT DEFAULT 1,
    XPTotal        INT DEFAULT 0,
    Data_Criacao   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo          BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (JogadorID) REFERENCES Users(ID) ON DELETE CASCADE
);


CREATE TABLE ExerciciosSolo (
    ExerciseID  VARCHAR(100) PRIMARY KEY,
    CategoriaID INT,                              -- [NOVO]
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',

    -- [NOVO] o fluxo fala em "missoes bloqueadas com cadeado".
    -- Precisa de um criterio de desbloqueio, senao nao da pra saber
    -- o que esta trancado.
    NivelMinimo INT NOT NULL DEFAULT 1,
    XPConcessao INT NOT NULL DEFAULT 10,

    Tempo_Limite_Segundos INT DEFAULT 0,          -- 0 = sem limite
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,    -- [ERRO] tinha virgula sobrando aqui

    FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL
);


CREATE TABLE SessionsSolo (
    ID         VARCHAR(100) PRIMARY KEY,
    CampanhaID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,

    WPM        DECIMAL(5,2),                      -- [MUDOU] era INT, perdia a casa decimal
    Precisao   DECIMAL(5,2),
    Acertos    INT,
    Erros      INT,
    Tempo_Gasto_Segundos INT,

    Concluida  BOOLEAN NOT NULL DEFAULT TRUE,     -- [NOVO] terminou x estourou o tempo
    XPGanho    INT NOT NULL DEFAULT 0,            -- [NOVO] quanto essa sessao rendeu

    Data_Sessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (CampanhaID) REFERENCES CampanhasSolo(CampanhaID) ON DELETE CASCADE,

    -- [MUDOU] era CASCADE. Apagar um exercicio apagava o historico
    -- de todo jogador que passou por ele.
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosSolo(ExerciseID) ON DELETE RESTRICT
);


-- =====================================================
-- 3. MUNDO PROFESSOR
-- =====================================================

CREATE TABLE ClassesProf (
    ClassID     VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    NomeTurma   VARCHAR(100) NOT NULL,

    -- [NOVO] o fluxo separa "Turmas Abertas" de "Turmas Arquivadas"
    -- em abas. Sem esses campos nao da pra fazer essa separacao.
    Ano         INT NOT NULL,
    Semestre    INT NOT NULL,
    Status      ENUM('Ativa','Encerrada') DEFAULT 'Ativa',

    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- [MUDOU] era CASCADE. Apagar professor derrubava as turmas
    -- e junto com elas todo o historico dos alunos.
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE RESTRICT
);


-- Matricula: liga aluno a turma  [NOVO]
-- Sem esta tabela o aluno so aparece na turma DEPOIS de fazer um
-- exercicio. A tela "lista de alunos da turma" ficava sem fonte de dado.
CREATE TABLE MatriculasProf (
    AlunoID VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    Data_Matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (AlunoID, ClassID),
    FOREIGN KEY (AlunoID) REFERENCES Alunos(ID)        ON DELETE CASCADE,
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
);


CREATE TABLE ExerciciosProf (
    ExerciseID  VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,            -- [MUDOU] era ClassID
    CategoriaID INT,                              -- [NOVO]
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (ProfessorID) REFERENCES Users(ID)      ON DELETE RESTRICT,
    FOREIGN KEY (CategoriaID) REFERENCES Categorias(ID) ON DELETE SET NULL
);
-- O exercicio agora pertence ao PROFESSOR, nao a uma turma.
-- Assim ele existe uma vez so e vai pra quantas turmas quiser.
-- Do jeito anterior, usar o mesmo texto em duas turmas exigia
-- duplicar o exercicio inteiro, e a "Biblioteca de Exercicios"
-- que aparece no fluxo nao fazia sentido.


-- Atribuicao: qual exercicio foi pra qual turma  [NOVO]
CREATE TABLE AtribuicoesProf (
    ClassID    VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Data_Atribuicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Prazo      DATETIME NULL,                     -- badge "Urgente" do fluxo do aluno

    PRIMARY KEY (ClassID, ExerciseID),
    FOREIGN KEY (ClassID)    REFERENCES ClassesProf(ClassID)      ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE CASCADE
);


CREATE TABLE SessionsProf (
    ID         VARCHAR(100) PRIMARY KEY,
    AlunoID    VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    ClassID    VARCHAR(100) NOT NULL,

    WPM        DECIMAL(5,2),                      -- [MUDOU] era INT
    Precisao   DECIMAL(5,2),
    Acertos    INT,
    Erros      INT,
    Tempo_Gasto_Segundos INT,

    Concluida  BOOLEAN NOT NULL DEFAULT TRUE,     -- [NOVO]

    Data_Sessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- [MUDOU] as tres eram CASCADE. Qualquer exclusao levava o
    -- historico junto, e o historico e requisito (RF21/RF22).
    FOREIGN KEY (AlunoID)    REFERENCES Alunos(ID)                ON DELETE RESTRICT,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE RESTRICT,
    FOREIGN KEY (ClassID)    REFERENCES ClassesProf(ClassID)       ON DELETE RESTRICT
);


-- =====================================================
-- 4. INDICES
-- As consultas mais pesadas do sistema saem daqui.
-- =====================================================
CREATE INDEX idx_sessoes_solo_campanha ON SessionsSolo(CampanhaID, Data_Sessao);
CREATE INDEX idx_sessoes_prof_aluno    ON SessionsProf(AlunoID, Data_Sessao);
CREATE INDEX idx_sessoes_prof_turma    ON SessionsProf(ClassID, Data_Sessao);


-- =====================================================
-- 5. DADOS INICIAIS
-- =====================================================
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


-- =====================================================
-- FORA DE ESCOPO NESTA VERSAO
-- =====================================================
-- O fluxo cita "Inventario / Loja" na navegacao do jogador solo.
-- Isso exigiria pelo menos: tabela de itens, tabela de posse do
-- jogador e uma moeda em CampanhasSolo. Nao foi incluido porque
-- e uma feature inteira e nao esta em nenhum requisito.
-- Se for entrar, precisa ser decidido antes, nao depois.
