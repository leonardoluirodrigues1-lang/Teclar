// categorias.service.ts
// As categorias de exercício (tabela Categorias), no grupo "Administração"
// do CONTRATO-API.md:
//   GET    /categorias       as ativas — qualquer token válido
//   POST   /categorias       cria — só administrador
//   PATCH  /categorias/:id   renomeia — só administrador
//   DELETE /categorias/:id   apaga (exclusão LÓGICA) — só administrador
//
// O nome só não pode repetir entre as categorias ATIVAS: uma apagada pode
// ter o nome reusado. O banco não consegue dizer "único entre as ativas"
// (ver o comentário da tabela no DB_Teclar_v9.sql), então quem confere é
// esta classe, antes de gravar: 409 CATEGORIA_DUPLICADA.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Identidade } from '../autenticacao/token.js';
import { BancoService } from '../banco/banco.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { exigirAdministrador } from './administrador-do-token.js';

export interface CorpoDaCategoria {
  nome?: unknown;
}

// A categoria na forma do tipo Categoria do front (js/nucleo/tipos.ts).
export interface Categoria {
  id: number;
  nome: string;
  ativo: boolean;
}

// Categorias.Nome é VARCHAR(50). O contrato só fala de "nome vazio"; o
// máximo é o da coluna, para um nome longo dar 400 em vez de erro 500 no
// INSERT. (Os LIMITES do front não têm regra de categoria.)
const NOME_MAXIMO = 50;

@Injectable()
export class CategoriasService {
  constructor(private readonly banco: BancoService) {}

  // GET /categorias. Ler não exige papel: a lista é a mesma para todos.
  async listar(): Promise<Categoria[]> {
    const categorias = await this.banco.categorias.findMany({ where: { Ativo: true }, orderBy: { ID: 'asc' } });
    return categorias.map(categoriaNaForma);
  }

  // POST /categorias. Primeiro o papel: quem não é administrador recebe o
  // 404 antes de qualquer validação, para não descobrir nem as regras.
  async criar(identidade: Identidade, corpo: CorpoDaCategoria): Promise<Categoria> {
    await exigirAdministrador(this.banco, identidade);
    const nome = nomeDaCategoria(corpo?.nome);
    await this.exigirNomeLivre(nome);
    const nova = await this.banco.categorias.create({ data: { Nome: nome } });
    return categoriaNaForma(nova);
  }

  // PATCH /categorias/:id. O contrato só lista o 404, mas o nome passa pelas
  // mesmas regras do POST: sem elas, renomear seria o jeito de criar um
  // nome vazio ou duas categorias ativas com o mesmo nome.
  async renomear(identidade: Identidade, id: string, corpo: CorpoDaCategoria): Promise<Categoria> {
    await exigirAdministrador(this.banco, identidade);
    const categoria = await this.categoriaAtiva(id);
    const nome = nomeDaCategoria(corpo?.nome);
    await this.exigirNomeLivre(nome, categoria.ID);
    const renomeada = await this.banco.categorias.update({ where: { ID: categoria.ID }, data: { Nome: nome } });
    return categoriaNaForma(renomeada);
  }

  // DELETE /categorias/:id. Exclusão LÓGICA (Ativo = false): a linha fica,
  // porque exercícios antigos podem apontar para ela. Enquanto algum
  // exercício ATIVO (do professor ou do Solo) usar a categoria, ela não sai.
  async apagar(identidade: Identidade, id: string): Promise<void> {
    await exigirAdministrador(this.banco, identidade);
    const categoria = await this.categoriaAtiva(id);
    const usos =
      (await this.banco.exerciciosprof.count({ where: { CategoriaID: categoria.ID, Ativo: true } })) +
      (await this.banco.exerciciossolo.count({ where: { CategoriaID: categoria.ID, Ativo: true } }));
    if (usos > 0) {
      throw new ConflictException({ mensagem: 'Categoria em uso por um exercício ativo.', codigo: 'CATEGORIA_EM_USO' });
    }
    await this.banco.categorias.update({ where: { ID: categoria.ID }, data: { Ativo: false } });
  }

  // A categoria pelo id da URL, se existir e estiver ativa. Apagada é o
  // mesmo 404 da que não existe (como o exercício arquivado). O id é INT
  // no banco: texto que não é número também é 404, e não 400 — para quem
  // chama, é só um id que não existe.
  private async categoriaAtiva(id: string) {
    const numero = Number(id);
    const categoria = Number.isInteger(numero)
      ? await this.banco.categorias.findFirst({ where: { ID: numero, Ativo: true } })
      : null;
    if (!categoria) {
      throw new NotFoundException({ mensagem: 'Categoria não encontrada.', codigo: 'NAO_ENCONTRADO' });
    }
    return categoria;
  }

  // 409 se outra categoria ATIVA já tem esse nome. A comparação é a da
  // collation do banco: "Literatura" e "literatura" são o mesmo nome.
  // `exceto` é a própria categoria no PATCH (renomear para o mesmo nome
  // não é conflito); no criar fica undefined, e o Prisma ignora o filtro.
  private async exigirNomeLivre(nome: string, exceto?: number): Promise<void> {
    const outra = await this.banco.categorias.findFirst({
      where: { Nome: nome, Ativo: true, ID: { not: exceto } },
    });
    if (outra) {
      throw new ConflictException({ mensagem: 'Já existe uma categoria com esse nome.', codigo: 'CATEGORIA_DUPLICADA' });
    }
  }
}

function categoriaNaForma(linha: Prisma.categoriasGetPayload<object>): Categoria {
  return { id: linha.ID, nome: linha.Nome, ativo: linha.Ativo };
}

// Aparado e com espaço repetido do meio reduzido a um, como o nome da
// turma: " Literatura  brasileira" e "Literatura brasileira" são o mesmo.
function nomeDaCategoria(valor: unknown): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw dadosInvalidos('Informe o nome da categoria.');
  }
  const nome = valor.trim().replace(/\s+/g, ' ');
  if (nome.length > NOME_MAXIMO) {
    throw dadosInvalidos(`O nome da categoria pode ter no máximo ${NOME_MAXIMO} caracteres.`);
  }
  return nome;
}

function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
