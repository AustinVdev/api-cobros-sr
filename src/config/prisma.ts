import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env'

// Parse DATABASE_URL explicitly — the mariadb driver doesn't always handle
// the mysql:// scheme reliably, so we destructure the URL into pool options.
function buildPoolConfig(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    connectTimeout: 10_000,
    // MySQL 8 defaults to caching_sha2_password; the mariadb driver needs
    // this flag to fetch the server's RSA public key over plain TCP (no TLS).
    allowPublicKeyRetrieval: true,
  }
}

const adapter = new PrismaMariaDb(buildPoolConfig(env.DATABASE_URL))

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

export default prisma
