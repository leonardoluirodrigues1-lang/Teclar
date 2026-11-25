-- TECLAR v10 | Post da atividade (instruções, links e anexos), para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem isto.
-- Rode uma vez, no cliente mysql. NÃO pode ser rodado duas vezes (as tabelas já existiriam).
-- Precisa do ALTER_v10_repeticoes.sql antes (ou de um banco já com Repeticoes).
USE teclardb_v10;

-- O "post" da atividade (estilo página de tarefa do Moodle): título,
-- instruções em Markdown, links e anexos. Um por atribuição, e some com ela
-- (retirar a atividade da turma apaga o post, os links e os anexos).
-- AbertoEm NULL = aberta desde a atribuição; no futuro, o aluno não vê a
-- atividade até lá. O vencimento é AtribuicoesProf.Prazo.
CREATE TABLE atribuicoesposts (
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Titulo VARCHAR(150) NOT NULL,
    Instrucoes TEXT NULL,                    -- Markdown; a tela mostra como HTML sanitizado
    AbertoEm DATETIME NULL,
    DataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ClassID, ExerciseID),
    CONSTRAINT fk_posts_atribuicao FOREIGN KEY (ClassID, ExerciseID)
        REFERENCES atribuicoesprof(ClassID, ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Até 5 links do post (só http/https, conferido no back).
CREATE TABLE atribuicoeslinks (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    Ordem INT NOT NULL,
    Titulo VARCHAR(150) NOT NULL,
    URL VARCHAR(2000) NOT NULL,
    CONSTRAINT fk_links_post FOREIGN KEY (ClassID, ExerciseID)
        REFERENCES atribuicoesposts(ClassID, ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Até 3 anexos do post, de até 2 MB (PDF, PNG, JPG, WEBP, DOCX; o tipo é
-- conferido pelo conteúdo no back). Conteudo só é lido no download.
CREATE TABLE atribuicoesanexos (
    ID VARCHAR(100) PRIMARY KEY,
    ClassID VARCHAR(100) NOT NULL,
    ExerciseID VARCHAR(100) NOT NULL,
    NomeArquivo VARCHAR(255) NOT NULL,
    Tipo VARCHAR(100) NOT NULL,
    Tamanho INT NOT NULL,
    Conteudo MEDIUMBLOB NOT NULL,
    DataEnvio DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_anexos_post (ClassID, ExerciseID),
    CONSTRAINT fk_anexos_post FOREIGN KEY (ClassID, ExerciseID)
        REFERENCES atribuicoesposts(ClassID, ExerciseID) ON DELETE CASCADE
) ENGINE=InnoDB;
