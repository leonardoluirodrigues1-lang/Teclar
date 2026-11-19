-- TECLAR v10 | Senha provisória do aluno, para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem isto.
-- Rode uma vez, no cliente mysql. NÃO pode ser rodado duas vezes (as colunas já existiriam).
--
-- O aluno entra pela primeira vez com a senha provisória que o professor
-- gerou (bcrypt em SenhaProvisoriaHash, válida até SenhaProvisoriaExpira).
-- O login apaga a provisória (uso único) e obriga o aluno a criar a senha dele.
-- Sem SenhaHash e sem provisória válida, nenhuma senha entra.
USE teclardb_v10;

ALTER TABLE alunosturmas
    ADD COLUMN SenhaProvisoriaHash VARCHAR(255) NULL AFTER SenhaHash,
    ADD COLUMN SenhaProvisoriaExpira TIMESTAMP NULL AFTER SenhaProvisoriaHash;
