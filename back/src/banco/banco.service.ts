// banco.service.ts
// A conexão com o MySQL. É o client do Prisma (gerado do teclarDB pelo
// db pull) virando um serviço do Nest, para os módulos de rota o
// receberem por injeção no construtor em vez de cada um abrir a sua.
//
// No Prisma 7 o client não fala com o banco sozinho: precisa de um
// "driver adapter". Para MySQL o adapter é o @prisma/adapter-mariadb (o
// driver mariadb fala o protocolo do MySQL também).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

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

// Monta a configuração do driver a partir do DATABASE_URL do .env — a
// mesma URL que a CLI do Prisma usa, para existir um lugar só com a senha.
function configuracaoDoBanco() {
  const texto = process.env.DATABASE_URL;
  if (!texto) {
    throw new Error('DATABASE_URL não definida. Copie o .env.example para .env e preencha a senha.');
  }

  const url = new URL(texto);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    // A URL guarda usuário e senha codificados (%40 no lugar de @).
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), // "/teclarDB" -> "teclarDB"
    // O MySQL 8 usa por padrão a autenticação caching_sha2_password, que
    // sem SSL precisa da chave pública do servidor. Sem esta opção o
    // driver recusa a conexão ("RSA public key is not available").
    // Aceitável aqui porque o banco é local; num servidor remoto o certo
    // seria SSL.
    allowPublicKeyRetrieval: true,
  };
}
