// A foto de perfil (Configurações > Conta), da conta (users.Foto) e do aluno
// (alunosturmas.Foto, por matrícula). Quem recorta o quadrado, reduz para no
// máximo 256×256 e converte em WEBP de até 50 KB é o navegador
// (js/utils/imagemDaCapa.ts, imagemDaFoto); aqui ficam os limites, conferidos
// por ./imagem-webp.ts como os da capa.
//
// A foto nunca vem nas outras consultas (o omit do BancoService): só as rotas
// de foto a pedem, com select: { Foto: true }. Quem precisa saber se existe
// usa temFoto, que consulta "Foto IS NOT NULL" sem trazer os bytes.
import { NotFoundException } from '@nestjs/common';
import { bytesDoWebp } from './imagem-webp.js';

export const FOTO_LADO_MAXIMO = 256;
export const FOTO_BYTES_MAXIMOS = 50 * 1024;

/** GET .../foto: a foto como data URL WEBP. */
export interface ImagemDaFoto {
  imagem: string;
}

export function bytesDaFoto(valor: unknown): Uint8Array<ArrayBuffer> {
  return bytesDoWebp(valor, {
    bytes: FOTO_BYTES_MAXIMOS,
    largura: FOTO_LADO_MAXIMO,
    altura: FOTO_LADO_MAXIMO,
    quadrada: true,
    oQue: 'A foto',
    aImagem: 'A foto',
  });
}

// Sem foto também é 404: a tela só pede quando o usuario (ou o aluno da
// lista) diz temFoto, e fora disso mostra as iniciais.
export function semFoto(): NotFoundException {
  return new NotFoundException({ mensagem: 'Sem foto de perfil.', codigo: 'NAO_ENCONTRADO' });
}
