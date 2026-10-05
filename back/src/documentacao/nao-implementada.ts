// nao-implementada.ts
// A resposta das rotas que estão no contrato mas ainda não têm código.
//
// Elas existem de verdade (aparecem no Swagger e respondem), para a
// documentação ficar completa e honesta: quem chama recebe 501 Not
// Implemented, e não um 404 que faria pensar que a rota não existe.
// O corpo segue a convenção de erro do contrato: { mensagem, codigo }.
// O código NAO_IMPLEMENTADA não está no contrato: ele some quando a última
// rota for implementada.
import { NotImplementedException } from '@nestjs/common';

export const CORPO_DA_ROTA_NAO_IMPLEMENTADA = {
  mensagem: 'Rota ainda não implementada.',
  codigo: 'NAO_IMPLEMENTADA',
};

// Uso no controller:  throw rotaNaoImplementada();
export function rotaNaoImplementada(): NotImplementedException {
  return new NotImplementedException(CORPO_DA_ROTA_NAO_IMPLEMENTADA);
}
