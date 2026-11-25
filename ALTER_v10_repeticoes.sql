-- TECLAR v10 | Repetições por atividade da turma, para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem isto.
-- Rode uma vez, no cliente mysql. NÃO pode ser rodado duas vezes (a coluna já existiria).
--
-- Quantas vezes (1 a 5) o aluno digita o texto do exercício nesta turma: o
-- texto repetido N vezes num bloco só, separado por espaço, com um
-- cronômetro só (tempo limite × N). As atribuições que já existem ficam com 1.
USE teclardb_v10;

ALTER TABLE atribuicoesprof ADD COLUMN Repeticoes INT NOT NULL DEFAULT 1 AFTER Prazo;
ALTER TABLE atribuicoesprof ADD CONSTRAINT chk_atribuicoes_repeticoes CHECK (Repeticoes BETWEEN 1 AND 5);
