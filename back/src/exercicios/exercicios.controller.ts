// exercicios.controller.ts
// As rotas HTTP do grupo "Biblioteca de exercícios (professor)". Só recebe
// e devolve: a regra está no ExerciciosService.
//
// O GuardaDoToken fica na classe, como em turmas. O tipo do token é
// conferido no service, rota a rota: GET /exercicios/:id é a única que
// aceita aluno, e as outras dão 403 TIPO_INVALIDO para ele.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import { ExerciciosService } from './exercicios.service.js';
import type { CorpoDoExercicio, Exercicio, Paginado } from './exercicios.service.js';

@Controller('exercicios')
@UseGuards(GuardaDoToken)
export class ExerciciosController {
  constructor(private readonly exercicios: ExerciciosService) {}

  @Get()
  listar(@Req() requisicao: RequisicaoComIdentidade): Promise<Paginado<Exercicio>> {
    return this.exercicios.listar(requisicao.identidade);
  }

  @Get(':id')
  obter(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('id') id: string,
    @Query('turma') turmaId?: string,
  ): Promise<Exercicio> {
    return this.exercicios.obter(requisicao.identidade, id, turmaId);
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post()
  @HttpCode(HttpStatus.OK)
  criar(@Req() requisicao: RequisicaoComIdentidade, @Body() corpo: CorpoDoExercicio): Promise<Exercicio> {
    return this.exercicios.criar(requisicao.identidade, corpo);
  }

  @Patch(':id')
  atualizar(
    @Req() requisicao: RequisicaoComIdentidade,
    @Param('id') id: string,
    @Body() corpo: CorpoDoExercicio,
  ): Promise<Exercicio> {
    return this.exercicios.atualizar(requisicao.identidade, id, corpo);
  }

  // DELETE na URL, arquivar no banco: ver ExerciciosService.arquivar.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  arquivar(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<void> {
    return this.exercicios.arquivar(requisicao.identidade, id);
  }
}
