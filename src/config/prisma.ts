import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env'

const adapter = new PrismaMariaDb(env.DATABASE_URL)

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

export default prisma
