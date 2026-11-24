-- TECLAR v10 | Foto de perfil da conta e do aluno, para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem isto.
-- Rode uma vez, no cliente mysql. NÃO pode ser rodado duas vezes (a coluna já existiria).
--
-- A foto que a pessoa escolhe em Configurações > Conta: o navegador recorta
-- o quadrado do meio, reduz para no máximo 256×256 e converte em WEBP de até
-- 50 KB; o back confere e grava os bytes aqui. MEDIUMBLOB, como a capa da
-- turma (BLOB para em 64 KB, que o base64 de 50 KB já encosta). NULL = sem
-- foto: a tela mostra as iniciais, como antes.
--   users.Foto         -- a conta (Solo e professor)
--   alunosturmas.Foto  -- o aluno, por matrícula (o mesmo nome em outra turma é outra foto)
USE teclardb_v10;

ALTER TABLE users ADD COLUMN Foto MEDIUMBLOB NULL AFTER Administrador;
ALTER TABLE alunosturmas ADD COLUMN Foto MEDIUMBLOB NULL AFTER Ativo;
