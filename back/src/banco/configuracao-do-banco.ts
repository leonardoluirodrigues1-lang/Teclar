// configuracao-do-banco.ts
// Monta a configuração do driver do MySQL a partir do DATABASE_URL do .env.
//
// Fica num arquivo próprio, sem nada do Nest, porque dois lugares precisam
// dela: o BancoService (o back rodando) e o seed (prisma/seed.ts, um script
// solto). A URL é a mesma que a CLI do Prisma usa, para existir um lugar
// só com a senha.
export function configuracaoDoBanco() {
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
    database: url.pathname.slice(1), // "/teclardb" -> "teclardb"
    // O MySQL 8 usa por padrão a autenticação caching_sha2_password, que
    // sem SSL precisa da chave pública do servidor. Sem esta opção o
    // driver recusa a conexão ("RSA public key is not available").
    // Aceitável aqui porque o banco é local; num servidor remoto o certo
    // seria SSL.
    allowPublicKeyRetrieval: true,
  };
}
