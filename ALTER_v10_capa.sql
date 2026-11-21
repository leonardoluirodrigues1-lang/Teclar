-- TECLAR v10 | Capa da turma com imagem, para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem isto.
-- Rode uma vez, no cliente mysql. NÃO pode ser rodado duas vezes (a coluna já existiria).
--
-- A imagem que o professor escolhe no computador: o navegador reduz para no
-- máximo 1200×400 e converte em WEBP de até 150 KB; o back confere e grava os
-- bytes aqui. MEDIUMBLOB porque BLOB para em 64 KB. NULL = a turma usa só o
-- desenho gerado pela CapaSemente, como antes.
USE teclardb_v10;

ALTER TABLE classesprof ADD COLUMN CapaImagem MEDIUMBLOB NULL AFTER CapaSemente;
