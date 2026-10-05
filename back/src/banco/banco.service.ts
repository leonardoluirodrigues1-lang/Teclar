// banco.service.ts
// A conexão com o MySQL. É o client do Prisma (gerado do teclardb pelo
// db pull) virando um serviço do Nest, para os módulos de rota o
// receberem por injeção no construtor em vez de cada um abrir a sua.
//
// No Prisma 7 o client não fala com o banco sozinho: precisa de um
// "driver adapter". Para MySQL o adapter é o @prisma/adapter-mariadb (o
// driver mariadb fala o protocolo do MySQL também).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { configuracaoDoBanco } from './configuracao-do-banco.js';

@Injectable()
export class BancoService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BancoService.name);

  constructor() {
    super({ adapter: new PrismaMariaDb(configuracaoDoBanco()) });
  }

  // Roda quando o Nest sobe. A consulta é só para descobrir já na subida se
  // o banco está acessível: sem ela, senha errada ou MySQL desligado só
  // apareceriam na primeira requisição, longe da causa.
  async onModuleInit(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (erro) {
      // O erro do driver vem embrulhado num "pool timeout" com um stack
      // enorme, e a causa real (senha errada, banco inexistente) fica lá
      // no fim. Esta linha diz onde olhar; o erro original segue junto.
      this.logger.error(
        'Não consegui conectar ao MySQL. Confira a DATABASE_URL no .env ' +
          '(senha, nome do banco) e se o serviço do MySQL está ligado.',
      );
      throw erro;
    }
    this.logger.log('Conectado ao banco.');
  }

  // Fecha as conexões quando o Nest desce (Ctrl+C, reinício do watch).
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
