// O erro 400 no corpo que o contrato define para todo erro: { mensagem, codigo }.
import { BadRequestException } from '@nestjs/common';

export function dadosInvalidos(mensagem: string): BadRequestException {
  return new BadRequestException({ mensagem, codigo: 'DADOS_INVALIDOS' });
}
