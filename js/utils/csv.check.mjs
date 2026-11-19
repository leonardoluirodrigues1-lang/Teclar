// Check de csv.ts: os arquivos que chegam de verdade na importação de alunos.
//   node js/utils/csv.check.mjs
//
// Roda no .js gerado pelo tsc (npm run build), não no .ts.
import assert from 'node:assert/strict';
import { decodificarCsv, parsearCsv, separarCabecalho } from './csv.js';

const CONHECIDAS = ['nome', 'aluno', 'estudante'];
const nomes = (bytes) => {
  const { linhas } = parsearCsv(decodificarCsv(bytes));
  const { coluna, dados } = separarCabecalho(linhas, CONHECIDAS);
  return dados.filter((l) => l.some((c) => c !== '')).map((l) => l[coluna]);
};

{
  // Excel BR: windows-1252, ";", cabeçalho com a coluna do nome no meio.
  const texto = 'Matrícula;Aluno;Turma\r\n1;João Conceição;9A\r\n2;Ângela;9A\r\n';
  const bytes = Uint8Array.from(texto, (c) => c.charCodeAt(0)); // latin-1 == cp1252 aqui
  assert.deepEqual(nomes(bytes), ['João Conceição', 'Ângela']);
}

{
  // UTF-8 com BOM, cabeçalho "NOME" (maiúscula).
  const bytes = new TextEncoder().encode('﻿NOME\r\nJoão\r\nMaria\r\n');
  assert.deepEqual(nomes(bytes), ['João', 'Maria']);
}

{
  // Google Sheets: UTF-8 sem BOM, ",", "Estudante" acentuado à toa.
  const bytes = new TextEncoder().encode('email,Éstudante\na@x.com,"Silva, João"\nb@x.com,Lúcia\n');
  assert.deepEqual(nomes(bytes), ['Silva, João', 'Lúcia']);
}

{
  // Uma coluna sem cabeçalho: a primeira linha é dado.
  const bytes = new TextEncoder().encode('João\nMaria\n');
  assert.deepEqual(nomes(bytes), ['João', 'Maria']);
}

{
  // Tab, sem cabeçalho conhecido: primeira coluna.
  const bytes = new TextEncoder().encode('Pedro\t9A\nLia\t9B\n');
  assert.equal(parsearCsv(decodificarCsv(bytes)).separador, '\t');
  assert.deepEqual(nomes(bytes), ['Pedro', 'Lia']);
}

console.log('csv.check: ok');
