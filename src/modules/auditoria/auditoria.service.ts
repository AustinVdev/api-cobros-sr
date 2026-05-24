import { Prisma } from '../../generated/prisma/client'
import prisma from '../../config/prisma'

interface RegistrarParams {
  evento: string
  resumenPayload?: Record<string, unknown>
  usuarioSistema?: string
}

export class AuditoriaService {
  static async registrar(
    params: RegistrarParams,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma
    await client.auditoria.create({
      data: {
        evento: params.evento,
        resumenPayload: params.resumenPayload
          ? (params.resumenPayload as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        usuarioSistema: params.usuarioSistema ?? 'sistema',
      },
    })
  }
}
