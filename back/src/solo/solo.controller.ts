// solo.controller.ts
// As rotas HTTP do grupo "Solo". Só recebe e devolve: a regra está nos
// três services (campanha, missões e progresso).
//
// O GuardaDoToken fica na classe: nenhuma rota do Solo é pública. O tipo
// do token (só conta) é conferido nos services, porque uma rota daqui,
// GET /solo/missoes/:id, aceita qualquer token.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuardaDoToken } from '../autenticacao/guarda-do-token.js';
import type { RequisicaoComIdentidade } from '../autenticacao/guarda-do-token.js';
import type { Paginado } from '../relatorios/relatorios.service.js';
import type { SessaoSolo } from '../sessoes/sessoes.service.js';
import { CampanhasService } from './campanhas.service.js';
import type { Campanha } from './campanhas.service.js';
import { MissoesService } from './missoes.service.js';
import type { Missao, MissaoDetalhe } from './missoes.service.js';
import { ProgressoService } from './progresso.service.js';
import type { CorpoDaSessaoSolo, EstatisticasSolo, IndicadoresSolo, RespostaSessaoSolo } from './progresso.service.js';

@Controller('solo')
@UseGuards(GuardaDoToken)
export class SoloController {
  constructor(
    private readonly campanhas: CampanhasService,
    private readonly missoes: MissoesService,
    private readonly progresso: ProgressoService,
  ) {}

  // --- a campanha do token -------------------------------------------------

  @Get('campanha')
  campanhaAtual(@Req() requisicao: RequisicaoComIdentidade): Promise<Campanha | null> {
    return this.campanhas.atual(requisicao.identidade);
  }

  // @HttpCode porque o Nest responde POST com 201, e o contrato diz 200.
  @Post('campanha')
  @HttpCode(HttpStatus.OK)
  criarCampanha(@Req() requisicao: RequisicaoComIdentidade): Promise<Campanha> {
    return this.campanhas.criar(requisicao.identidade);
  }

  @Get('campanhas/:id')
  campanha(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<Campanha> {
    return this.campanhas.obter(requisicao.identidade, id);
  }

  @Delete('campanhas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  apagarCampanha(@Req() requisicao: RequisicaoComIdentidade, @Param('id') id: string): Promise<void> {
    return this.campanhas.apagar(requisicao.identidade, id);
  }

  // --- as lições -----------------------------------------------------------

  @Get('missoes')
  missoesDoPercurso(@Req() requisicao: RequisicaoComIdentidade): Promise<Missao[]> {
    return this.missoes.listar(requisicao.identidade);
  }

  // Sem a identidade: qualquer token válido lê uma lição (o guard já
  // conferiu que o token vale).
  @Get('missoes/:id')
  missao(@Param('id') id: string): Promise<MissaoDetalhe> {
    return this.missoes.obter(id);
  }

  // --- o progresso ---------------------------------------------------------

  @Post('sessoes')
  @HttpCode(HttpStatus.OK)
  registrarSessao(
    @Req() requisicao: RequisicaoComIdentidade,
    @Body() corpo: CorpoDaSessaoSolo,
  ): Promise<RespostaSessaoSolo> {
    return this.progresso.registrar(requisicao.identidade, corpo);
  }

  @Get('historico')
  historico(@Req() requisicao: RequisicaoComIdentidade): Promise<Paginado<SessaoSolo>> {
    return this.progresso.historico(requisicao.identidade);
  }

  @Get('indicadores')
  indicadores(@Req() requisicao: RequisicaoComIdentidade): Promise<IndicadoresSolo> {
    return this.progresso.indicadores(requisicao.identidade);
  }

  @Get('estatisticas')
  estatisticas(@Req() requisicao: RequisicaoComIdentidade): Promise<EstatisticasSolo> {
    return this.progresso.estatisticas(requisicao.identidade);
  }
}
