CREATE DATABASE IF NOT EXISTS teclarDB;
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

-- Tabela isolada para Alunos (login por ID/Matricula + senha).
-- Nao tem vinculo com Users: e outro caminho de entrada.
-- Nome e opcional: o professor preenche se quiser, e as telas caem
-- para a matricula quando estiver vazio.
-- ALTERADO: UserID novo.
-- O ID do aluno passa a ser o RP ("RP" + 7 digitos), gerado pelo BACK no
-- cadastro da conta. Quem cria conta ganha, na mesma hora, um RP e uma
-- senha de aluno. Por isso Alunos deixa de ser tabela solta e aponta para
-- a conta dona: e dela que vem o Nome.
-- Nome continua NULL para aluno antigo, sem conta ligada.
CREATE TABLE Alunos (
    ID VARCHAR(100) PRIMARY KEY,           -- o RP: RP + 7 digitos
    UserID VARCHAR(100) NULL,              -- a conta dona; NULL = aluno antigo
    Nome VARCHAR(150) NULL,
    SenhaHash VARCHAR(255) NOT NULL,       -- senha de aluno, gerada pelo sistema

    CONSTRAINT fk_aluno_user FOREIGN KEY (UserID)
        REFERENCES Users(ID) ON DELETE CASCADE
);

-- ==========================================
-- 2. UNIVERSO SOLO
-- ==========================================

-- Gerencia o "Save" e a gamificacao do jogador adulto
CREATE TABLE CampanhasSolo (
    CampanhaID VARCHAR(100) PRIMARY KEY,
    JogadorID VARCHAR(100) NOT NULL,
    NivelAtual INT DEFAULT 1,
    XPTotal INT DEFAULT 0,
    FOREIGN KEY (JogadorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- ALTERADO: Nivel, Repeticoes e Ordem novos.
-- As 76 licoes do professor vem em 10 niveis pedagogicos, com numero de
-- repeticoes por licao e uma sequencia fixa. Dificuldade (ENUM de 3) nao
-- comporta os 10 niveis, e sem Ordem a campanha vira lista embaralhada.
CREATE TABLE ExerciciosSolo (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,       -- 0 = sem limite
    Nivel       INT NOT NULL DEFAULT 1,        -- 1 a 10 (dificuldade pedagogica)
    Repeticoes  INT NOT NULL DEFAULT 1,        -- quantas vezes a licao se repete
    Ordem       INT NOT NULL DEFAULT 0,        -- sequencia na campanha (1 a 76)
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,

    INDEX idx_solo_ordem (Ordem)
);

-- Sessoes de jogo vinculadas diretamente a campanha do usuario
CREATE TABLE SessionsSolo (
    ID VARCHAR(100) PRIMARY KEY,
    CampanhaID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    WPM INT,
    Precisao DECIMAL(5,2),
    Acertos INT,
    Erros INT,
    Tempo_Gasto_Segundos INT,
    Concluida BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE = terminou o texto | FALSE = estourou o tempo
    Data_Sessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (CampanhaID) REFERENCES CampanhasSolo(CampanhaID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosSolo(ExerciseID) ON DELETE CASCADE
);

-- ==========================================
-- 3. UNIVERSO PROFESSOR E ALUNOS
-- ==========================================

CREATE TABLE ClassesProf (
    ClassID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    NomeTurma VARCHAR(100),
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- ALTERADO: Status e Data_Convite novos.
-- O professor nao cadastra mais aluno: ele CONVIDA pelo RP exato. Uma linha
-- aqui deixou de significar "esta na turma" e passou a guardar o estado do
-- convite. Sem Status nao existe "foi chamado e ainda nao respondeu".
-- Contagem de alunos, medias e relatorios usam WHERE Status = 'ativo'.
CREATE TABLE ClassMembers (
    ID  VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'ativo',   -- convidado | ativo | recusado
    Data_Convite DATETIME NULL,                    -- quando o professor convidou
    Data_Matricula DATETIME DEFAULT CURRENT_TIMESTAMP, -- quando o aluno aceitou

    PRIMARY KEY (ID, ClassID),
    INDEX idx_membro_status (ClassID, Status),

    FOREIGN KEY (ID)  REFERENCES Alunos(ID)   ON DELETE CASCADE,
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
);

-- O exercicio pertence ao PROFESSOR, nao a uma turma.
-- Assim ele existe uma vez so e vai para quantas turmas quiser.
CREATE TABLE ExerciciosProf (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    Titulo      VARCHAR(100) NOT NULL,
    Texto       TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,       -- 0 = sem limite
    Ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- Qual exercicio foi atribuido a qual turma
CREATE TABLE AtribuicoesProf (
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Data_Atribuicao DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (ClassID, ExerciseID),
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE CASCADE
);

-- Sessao do ALUNO: o que ele fez em cada exercicio atribuido.
-- E esta a tabela que guarda o desempenho do aluno.
CREATE TABLE SessionsProf (
    ID VARCHAR(100) PRIMARY KEY,
    AlunoID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    WPM INT,
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
