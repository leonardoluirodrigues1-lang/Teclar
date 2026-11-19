-- TECLAR v10 | Complementos para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem tudo isto.
-- Rode uma vez, no cliente mysql. Cada bloco pode ser rodado de novo sem erro.
USE teclardb_v10;

-- Fase 4: nível escolar. nivelAtual = 1 + floor(licoes / licoes_por_nivel).
INSERT IGNORE INTO configuracoes (Chave, Valor, Descricao)
VALUES ('licoes_por_nivel', '3', 'Licoes distintas por nivel escolar');
