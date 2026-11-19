-- TECLAR v10 | Complementos para um banco teclardb_v10 já criado
-- Quem instala do zero com DB_Teclar_v10.sql já tem tudo isto.
-- Rode uma vez, no cliente mysql. O bloco da Fase 4 pode ser repetido; o da Fase 5 não.
USE teclardb_v10;

-- Fase 4: nível escolar. nivelAtual = 1 + floor(licoes / licoes_por_nivel).
INSERT IGNORE INTO configuracoes (Chave, Valor, Descricao)
VALUES ('licoes_por_nivel', '3', 'Licoes distintas por nivel escolar');

-- Fase 5: tentativa única e CHECKs das medidas.
-- Antes do CHECK, confira se há linha fora da regra (as duas contagens devem dar 0):
-- SELECT COUNT(*) FROM sessionssolo WHERE Precisao NOT BETWEEN 0 AND 100 OR WPM < 0
--     OR Acertos < 0 OR Erros < 0 OR Tempo_Gasto_Segundos < 0;
-- SELECT COUNT(*) FROM sessionsprof WHERE Precisao NOT BETWEEN 0 AND 100 OR WPM < 0
--     OR Acertos < 0 OR Erros < 0 OR Tempo_Gasto_Segundos < 0;
-- Este bloco NÃO pode ser rodado duas vezes (a coluna já existiria).
ALTER TABLE sessionssolo
    ADD COLUMN TentativaID VARCHAR(100) NULL,
    ADD CONSTRAINT uq_sessoes_solo_tentativa UNIQUE (CampanhaID, TentativaID),
    ADD CONSTRAINT chk_sessoes_solo_medidas CHECK (
        (Precisao IS NULL OR Precisao BETWEEN 0 AND 100) AND (WPM IS NULL OR WPM >= 0)
        AND (Acertos IS NULL OR Acertos >= 0) AND (Erros IS NULL OR Erros >= 0)
        AND (Tempo_Gasto_Segundos IS NULL OR Tempo_Gasto_Segundos >= 0));

ALTER TABLE sessionsprof
    ADD COLUMN TentativaID VARCHAR(100) NULL,
    ADD CONSTRAINT uq_sessoes_prof_tentativa UNIQUE (ClassID, AlunoID, TentativaID),
    ADD CONSTRAINT chk_sessoes_prof_medidas CHECK (
        (Precisao IS NULL OR Precisao BETWEEN 0 AND 100) AND (WPM IS NULL OR WPM >= 0)
        AND (Acertos IS NULL OR Acertos >= 0) AND (Erros IS NULL OR Erros >= 0)
        AND (Tempo_Gasto_Segundos IS NULL OR Tempo_Gasto_Segundos >= 0));
