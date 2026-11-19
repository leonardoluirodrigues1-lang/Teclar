-- TECLAR v10 | Instalação nova no MySQL
-- MySQL 8.0.16 ou superior para validar as restrições CHECK.
-- Use este arquivo para começar com as categorias e configurações padrão.
-- Para trazer os dados de teclardb (v9), use Migrar_Teclar_v9_para_v10.sql.
-- O banco de destino teclardb_v10 deve ser novo.

CREATE DATABASE teclardb_v10
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE teclardb_v10;

-- Conta usada tanto no Solo quanto no painel de Professor.
CREATE TABLE teclardb_v10.users (
    ID VARCHAR(100) PRIMARY KEY,
    Nome VARCHAR(150) NOT NULL,
    Email VARCHAR(150) UNIQUE NOT NULL,
    GoogleID VARCHAR(100) UNIQUE NULL,
    SenhaHash VARCHAR(255) NULL,
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,
    Administrador BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_users_login CHECK (GoogleID IS NOT NULL OR SenhaHash IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.categorias (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(50) NOT NULL,
    Ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.configuracoes (
    Chave VARCHAR(50) PRIMARY KEY,
    Valor VARCHAR(255) NOT NULL,
    Descricao VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.campanhassolo (
    CampanhaID VARCHAR(100) PRIMARY KEY,
    JogadorID VARCHAR(100) NOT NULL,
    NivelAtual INT DEFAULT 1,
    XPTotal INT DEFAULT 0,
    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_campanha_jogador UNIQUE (JogadorID),
    FOREIGN KEY (JogadorID) REFERENCES teclardb_v10.users(ID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.exerciciossolo (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    CategoriaID INT NULL,
    Titulo VARCHAR(100) NOT NULL,
    Texto TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,      -- 0 = sem limite
    Nivel INT NOT NULL DEFAULT 1,             -- nível pedagógico da lição
    Repeticoes INT NOT NULL DEFAULT 1,
    Ordem INT NOT NULL DEFAULT 0,
    NivelMinimo INT NOT NULL DEFAULT 1,
    XPConcessao INT NOT NULL DEFAULT 10,
    Ativo BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_solo_ordem (Ordem),
    FOREIGN KEY (CategoriaID) REFERENCES teclardb_v10.categorias(ID) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.sessionssolo (
    ID VARCHAR(100) PRIMARY KEY,
    CampanhaID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    WPM DECIMAL(5,2),
    Precisao DECIMAL(5,2),
    Acertos INT,
    Erros INT,
    Tempo_Gasto_Segundos INT,
    Concluida BOOLEAN NOT NULL DEFAULT TRUE,
    XPGanho INT NOT NULL DEFAULT 0,
    Data_Sessao TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_sessoes_solo_campanha (CampanhaID, Data_Sessao),
    FOREIGN KEY (CampanhaID) REFERENCES teclardb_v10.campanhassolo(CampanhaID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES teclardb_v10.exerciciossolo(ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.classesprof (
    ClassID VARCHAR(100) PRIMARY KEY,
    Codigo VARCHAR(12) NOT NULL UNIQUE,
    NomeTurma VARCHAR(100),
    Ano INT NULL,
    Semestre INT NULL,                       -- NULL preserva turmas v9 sem período
    Ativa BOOLEAN NOT NULL DEFAULT TRUE,     -- FALSE = arquivada
    CapaSemente INT NULL,
    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_turma_semestre CHECK (Semestre IS NULL OR Semestre IN (1, 2))
) ENGINE=InnoDB;

-- O backend cria turma e vínculo juntos. Cada turma tem um responsável.
-- O professor pode criar várias turmas. Arquivar preserva o vínculo.
CREATE TABLE teclardb_v10.professoresturmas (
    ClassID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    INDEX idx_professores_turmas_professor (ProfessorID),
    CONSTRAINT fk_professores_turmas_turma FOREIGN KEY (ClassID)
        REFERENCES teclardb_v10.classesprof(ClassID) ON DELETE CASCADE,
    CONSTRAINT fk_professores_turmas_conta FOREIGN KEY (ProfessorID)
        REFERENCES teclardb_v10.users(ID) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Identificador usado pelo backend, inclusive no token do aluno.
CREATE TABLE teclardb_v10.alunos (
    ID VARCHAR(100) PRIMARY KEY
) ENGINE=InnoDB;

-- As credenciais pertencem à matrícula. Para outra turma, crie outro ID.
-- O login busca a turma por Codigo e a matrícula por (ClassID, Nome).
CREATE TABLE teclardb_v10.alunosturmas (
    ClassID VARCHAR(100) NOT NULL,
    AlunoID VARCHAR(100) NOT NULL,
    Nome VARCHAR(150) NOT NULL,
    SenhaHash VARCHAR(255) NULL,             -- NULL até o primeiro acesso ou após redefinição
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (ClassID, AlunoID),
    CONSTRAINT uq_alunos_turmas_aluno UNIQUE (AlunoID),
    CONSTRAINT uq_aluno_turma_nome UNIQUE (ClassID, Nome),
    CONSTRAINT fk_alunos_turmas_turma FOREIGN KEY (ClassID)
        REFERENCES teclardb_v10.classesprof(ClassID) ON DELETE RESTRICT,
    CONSTRAINT fk_alunos_turmas_aluno FOREIGN KEY (AlunoID)
        REFERENCES teclardb_v10.alunos(ID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE teclardb_v10.exerciciosprof (
    ExerciseID VARCHAR(100) PRIMARY KEY,
    ProfessorID VARCHAR(100) NOT NULL,
    CategoriaID INT NULL,
    Titulo VARCHAR(100) NOT NULL,
    Texto TEXT NOT NULL,
    Dificuldade ENUM('facil','medio','dificil') NOT NULL DEFAULT 'facil',
    Tempo_Limite_Segundos INT DEFAULT 0,      -- 0 = sem limite
    Ativo BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (ProfessorID) REFERENCES teclardb_v10.users(ID) ON DELETE CASCADE,
    FOREIGN KEY (CategoriaID) REFERENCES teclardb_v10.categorias(ID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Um exercício da biblioteca pode ser atribuído a várias turmas.
CREATE TABLE teclardb_v10.atribuicoesprof (
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Data_Atribuicao DATETIME DEFAULT CURRENT_TIMESTAMP,
    Prazo DATETIME NULL,
    PRIMARY KEY (ClassID, ExerciseID),
    FOREIGN KEY (ClassID) REFERENCES teclardb_v10.classesprof(ClassID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES teclardb_v10.exerciciosprof(ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- A FK composta obriga a sessão a usar a turma da matrícula.
-- O backend confere a atribuição ao salvar. Retirar uma atribuição preserva o histórico.
CREATE TABLE teclardb_v10.sessionsprof (
    ID VARCHAR(100) PRIMARY KEY,
    AlunoID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    ClassID VARCHAR(100) NOT NULL,
    WPM DECIMAL(5,2),
    Precisao DECIMAL(5,2),
    Acertos INT,
    Erros INT,
    Tempo_Gasto_Segundos INT,
    Concluida BOOLEAN NOT NULL DEFAULT TRUE,
    Data_Sessao TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_sessoes_prof_matricula (ClassID, AlunoID),
    INDEX idx_sessoes_prof_aluno (AlunoID, Data_Sessao),
    INDEX idx_sessoes_prof_turma (ClassID, Data_Sessao),
    CONSTRAINT fk_sessoes_prof_matricula FOREIGN KEY (ClassID, AlunoID)
        REFERENCES teclardb_v10.alunosturmas(ClassID, AlunoID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES teclardb_v10.exerciciosprof(ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Dados iniciais para uma instalação nova.
INSERT INTO teclardb_v10.categorias (Nome) VALUES
    ('Textos gerais'),
    ('Programacao'),
    ('Ortografia'),
    ('Numeros e simbolos'),
    ('Literatura');

INSERT INTO teclardb_v10.configuracoes (Chave, Valor, Descricao) VALUES
    ('wpm_meta_padrao',              '40',  'Meta de palavras por minuto'),
    ('precisao_minima',              '90',  'Precisao minima em porcentagem'),
    ('tempo_limite_padrao_segundos', '60',  'Tempo limite padrao de um exercicio'),
    ('xp_por_nivel',                 '200', 'XP necessario para subir de nivel'),
    ('licoes_por_nivel',             '3',   'Licoes distintas por nivel escolar');
