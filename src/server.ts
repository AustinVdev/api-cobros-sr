import 'dotenv/config'
import app from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import prisma from './config/prisma'

async function bootstrap(): Promise<void> {
  await prisma.$connect()
  logger.info('Conexión a la base de datos establecida')

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando')
  })

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Señal de cierre recibida')
    server.close(async () => {
      await prisma.$disconnect()
      logger.info('Servidor detenido correctamente')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el servidor:', err)
  process.exit(1)
})
