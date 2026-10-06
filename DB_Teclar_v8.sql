-- ==========================================
-- TECLAR - DB_Teclar_v8.sql
-- Base: v7 inteiro. O historico das versoes anteriores (o que entrou na
-- v6 e na v7, e por que) esta no cabecalho do DB_Teclar_v7.sql.
--
-- O que mudou em relacao a v7: o FLUXO DE ENTRADA DO ALUNO.
--
-- Antes (v6/v7): toda conta (Users) ganhava um RP e uma senha de aluno
-- gerada pelo sistema. O professor convidava pelo RP, o aluno aceitava ou
-- recusava, e ClassMembers guardava o estado do convite (convidado,
-- ativo, recusado) ligando o aluno global a cada turma.
--
-- Agora (v8):
--   1. O professor cria a turma e o sistema gera um codigo
--      (ClassesProf.Codigo).
--   2. O professor sobe um CSV com os nomes dos alunos: cada nome vira uma
--      linha em Alunos, ja DENTRO da turma, com SenhaHash = NULL.
--   3. O aluno abre o site e digita o codigo da turma, o proprio nome e uma
--      senha. Primeiro acesso (SenhaHash NULL): a senha e gravada. Nos
--      seguintes: a senha e conferida. Nome fora da lista nao entra.
--   Nao existe e-mail, RP nem convite para o aluno. O aluno nao e ligado a
--   conta (Users): sai Alunos.UserID e a FK para Users.
--   O mesmo aluno em duas turmas sao DUAS linhas independentes, com
--   historicos separados.
--
-- Por que a ClassMembers saiu:
--   Ela existia para ligar um aluno global a varias turmas e para guardar o
--   estado do convite. Com o aluno nascendo dentro de uma turma
--   (Alunos.ClassID) e sem convite, a ligacao ja esta na propria linha do
--   aluno e nao ha estado para guardar. Saem junto Status, Data_Convite e
--   Data_Matricula. "Aluno da turma" agora e WHERE Alunos.ClassID = ?
--   (e Ativo = TRUE), nao mais WHERE Status = 'ativo'.
--
-- SessionsProf nao mudou: AlunoID aponta para Alunos, que ja carrega a
-- turma. O ClassID da sessao fica mesmo assim, porque as consultas de
-- relatorio filtram por ele direto (idx_sessoes_prof_turma). O back grava
-- nele o mesmo ClassID do aluno.
-- (A unica diferenca no CREATE e o nome explicito da FK de AlunoID,
-- fk_sessao_aluno, para o banco novo e o migrado ficarem iguais.)
--
-- Os ON DELETE continuam os da v6/v7. A FK nova Alunos.ClassID e CASCADE:
-- apagar a turma apaga os alunos dela (e, pela FK de AlunoID, as sessoes).
-- ==========================================

-- Nome em minusculas de proposito. No Windows o MySQL guarda o nome do
-- banco em minusculas (lower_case_table_names = 1) mesmo que o CREATE use
-- maiuscula, e o Prisma compara esse nome com o da DATABASE_URL
-- diferenciando caixa: com "teclarDB" na URL, o prisma db pull descartava
-- todas as chaves estrangeiras. Em minusculas aqui e na URL, bate em
-- qualquer sistema. (No Windows, "teclardb" e o mesmo banco ja criado.)
CREATE DATABASE IF NOT EXISTS teclardb
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE teclardb;

-- ==========================================
-- 1. CONTAS
-- ==========================================

-- Conta unica. NAO existe coluna de perfil: o universo (Solo ou Professor)
-- e escolhido depois do login e pode mudar a qualquer momento.
-- A mesma conta pode ter campanha no Solo E turmas como professor.
-- v8: o aluno NAO tem conta aqui. Ele mora em Alunos, dentro da turma.
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
-- v8: Codigo, gerado pelo back na criacao: e o que o aluno digita para
-- entrar. UNIQUE no sistema todo, porque o login do aluno procura a turma
-- so por ele.
CREATE TABLE ClassesProf (
    ClassID VARCHAR(100) PRIMARY KEY,
    Codigo VARCHAR(12) NOT NULL UNIQUE,        -- o codigo que o aluno digita
    ProfessorID VARCHAR(100) NOT NULL,
    NomeTurma VARCHAR(100),
    Ano INT NULL,
    Semestre INT NULL,
    Ativa BOOLEAN NOT NULL DEFAULT TRUE,
    CapaSemente INT NULL,                      -- semente da capa; NULL = a tela deriva do id
    Data_Criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProfessorID) REFERENCES Users(ID) ON DELETE CASCADE
);

-- v8: o aluno e POR TURMA. Cada linha nasce do CSV do professor, ja dentro
-- da turma, com SenhaHash NULL. O primeiro acesso (codigo + nome + senha)
-- grava a senha; os seguintes conferem. O mesmo aluno em duas turmas sao
-- duas linhas, com historicos separados. Sem UserID: o aluno nao tem conta.
--
-- UNIQUE (ClassID, Nome): o login procura o aluno pelo par, entao o par nao
-- pode repetir. A collation e utf8mb4_unicode_ci: "Ana Pires", "ana pires"
-- e "Ána Pires" sao o MESMO nome, tanto para o UNIQUE quanto para o
-- WHERE Nome = ? do login. Espaco no fim tambem e ignorado na comparacao.
CREATE TABLE Alunos (
    ID VARCHAR(100) PRIMARY KEY,               -- gerado pelo back
    ClassID VARCHAR(100) NOT NULL,
    Nome VARCHAR(150) NOT NULL,
    SenhaHash VARCHAR(255) NULL,               -- NULL ate o primeiro acesso
    Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Ativo BOOLEAN DEFAULT TRUE,

    CONSTRAINT uq_aluno_turma_nome UNIQUE (ClassID, Nome),
    CONSTRAINT fk_aluno_turma FOREIGN KEY (ClassID)
        REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
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
-- v8: AlunoID ja identifica a turma (Alunos.ClassID). ClassID continua
-- aqui porque os relatorios filtram por ele; o back grava o mesmo valor.
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
    CONSTRAINT fk_sessao_aluno FOREIGN KEY (AlunoID)
        REFERENCES Alunos(ID) ON DELETE CASCADE,
    FOREIGN KEY (ExerciseID) REFERENCES ExerciciosProf(ExerciseID) ON DELETE CASCADE,
    FOREIGN KEY (ClassID) REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
);

-- ==========================================
-- 4. INDICES
-- As consultas mais pesadas do sistema saem daqui.
-- (Alunos por turma usa o indice do UNIQUE (ClassID, Nome).)
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
-- Se o banco ja esta na v7, use isto em vez de recriar.
-- (De versoes anteriores: aplique antes a secao de ALTER do v7.)
-- Rode na ordem. Faca backup antes: os passos 2 e 3 apagam dados.
-- ==========================================
-- USE teclardb;
--
-- 1. Codigo da turma. Turma existente ganha um codigo provisorio derivado
--    do id (8 caracteres): NOT NULL UNIQUE direto falharia, porque todas
--    as linhas nasceriam com o mesmo valor vazio.
-- ALTER TABLE ClassesProf ADD Codigo VARCHAR(12) NULL AFTER ClassID;
-- UPDATE ClassesProf SET Codigo = UPPER(LEFT(MD5(ClassID), 8));
-- ALTER TABLE ClassesProf MODIFY Codigo VARCHAR(12) NOT NULL,
--     ADD UNIQUE (Codigo);
--
-- 2. Alunos por turma. Cada matricula ATIVA da ClassMembers vira uma
--    linha nova, com id novo; RPAntigo e so a ponte para remapear as
--    sessoes e sai no fim. Convidados e recusados nao viram aluno: no
--    fluxo novo, quem entra e o CSV do professor.
--    Nome: o da conta dona, senao o que estava em Alunos, senao o RP
--    (Nome agora e NOT NULL). A senha de aluno antiga e copiada, para o
--    aluno migrado continuar protegido: ele entra com a senha que ja tinha.
-- CREATE TABLE AlunosV8 (
--     ID VARCHAR(100) PRIMARY KEY,
--     ClassID VARCHAR(100) NOT NULL,
--     Nome VARCHAR(150) NOT NULL,
--     SenhaHash VARCHAR(255) NULL,
--     Data_Cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     Ativo BOOLEAN DEFAULT TRUE,
--     RPAntigo VARCHAR(100) NOT NULL,
--     CONSTRAINT uq_aluno_turma_nome UNIQUE (ClassID, Nome),
--     CONSTRAINT fk_aluno_turma FOREIGN KEY (ClassID)
--         REFERENCES ClassesProf(ClassID) ON DELETE CASCADE
-- );
-- INSERT INTO AlunosV8 (ID, ClassID, Nome, SenhaHash, Data_Cadastro, Ativo, RPAntigo)
-- SELECT UUID(), m.ClassID, COALESCE(u.Nome, a.Nome, a.ID), a.SenhaHash,
--        COALESCE(m.Data_Matricula, a.Data_Cadastro), a.Ativo, a.ID
-- FROM ClassMembers m
-- JOIN Alunos a      ON a.ID = m.ID
-- LEFT JOIN Users u  ON u.ID = a.UserID
-- WHERE m.Status = 'ativo';
--
-- 3. Sessoes: AlunoID passa do RP para o id novo do aluno NAQUELA turma.
--    A FK de AlunoID da v7 nao tinha nome: confira o nome gerado com
--    SHOW CREATE TABLE SessionsProf; (no Windows costuma ser
--    sessionsprof_ibfk_1). Sessao sem matricula ativa correspondente e
--    apagada: o aluno ja tinha saido da turma, e a FK nova nao aceitaria.
-- ALTER TABLE SessionsProf DROP FOREIGN KEY sessionsprof_ibfk_1;
-- UPDATE SessionsProf s
-- JOIN AlunosV8 n ON n.RPAntigo = s.AlunoID AND n.ClassID = s.ClassID
-- SET s.AlunoID = n.ID;
-- DELETE s FROM SessionsProf s
-- LEFT JOIN AlunosV8 n ON n.ID = s.AlunoID
-- WHERE n.ID IS NULL;
--
-- 4. Troca as tabelas. ClassMembers sai inteira (com Status, Data_Convite
--    e Data_Matricula); a Alunos da v7 (com UserID e a FK para Users) tambem.
-- DROP TABLE ClassMembers;
-- DROP TABLE Alunos;
-- RENAME TABLE AlunosV8 TO Alunos;
-- ALTER TABLE Alunos DROP COLUMN RPAntigo;
-- ALTER TABLE SessionsProf ADD CONSTRAINT fk_sessao_aluno
--     FOREIGN KEY (AlunoID) REFERENCES Alunos(ID) ON DELETE CASCADE;
--
-- Atencao:
-- - O INSERT do passo 2 falha no UNIQUE se dois alunos ativos da mesma
--   turma tiverem o mesmo nome (lembrando que caixa e acento nao
--   diferenciam). Ache-os antes com:
--     SELECT m.ClassID, COALESCE(u.Nome, a.Nome, a.ID) AS Nome, COUNT(*)
--     FROM ClassMembers m JOIN Alunos a ON a.ID = m.ID
--     LEFT JOIN Users u ON u.ID = a.UserID
--     WHERE m.Status = 'ativo'
--     GROUP BY 1, 2 HAVING COUNT(*) > 1;
--   e acrescente algo ao nome de um deles.
-- - O codigo provisorio do passo 1 so e unico na pratica (8 hex do MD5);
--   se o ALTER reclamar de duplicado, troque o de uma das turmas na mao.
-- - Data_Cadastro do aluno migrado vira a data em que ele entrou na turma
--   (Data_Matricula), que e o que "cadastro" passa a significar.
