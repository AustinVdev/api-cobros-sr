import { Prisma, EstadoCobro } from '../../generated/prisma/client'
import prisma from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { AuditoriaService } from '../auditoria/auditoria.service'
import type { CreateCobroDTO, FiltrosCobrosDTO } from './cobros.validators'

const MONTO_LIMITE = new Prisma.Decimal('1000')

export interface DetalleItem {
  id: number
  estado: string
  accion: 'PROCESADO' | 'OMITIDO'
  motivo?: string
}

export interface ResultadoLote {
  total: number
  procesados: number
  fallidos: number
  omitidos: number
  detalle: DetalleItem[]
}

async function aplicarProcesamiento(
  cobroId: bigint,
  monto: Prisma.Decimal,
  moneda: string,
  tx: Prisma.TransactionClient,
): Promise<EstadoCobro> {
  const nuevoEstado: EstadoCobro = monto.lessThanOrEqualTo(MONTO_LIMITE)
    ? EstadoCobro.PROCESADO
    : EstadoCobro.FALLIDO

  await tx.cobro.update({
    where: { id: cobroId },
    data: { estado: nuevoEstado, fechaProceso: new Date() },
  })

  await AuditoriaService.registrar(
    {
      evento: `COBRO_${nuevoEstado}`,
      resumenPayload: {
        cobroId: cobroId.toString(),
        monto: monto.toString(),
        moneda,
        estado: nuevoEstado,
      },
    },
    tx,
  )

  return nuevoEstado
}

export class CobrosService {
  async crear(data: CreateCobroDTO) {
    const clienteId = BigInt(data.clienteId)
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })

    if (!cliente) {
      throw AppError.notFound(`Cliente ${data.clienteId} no encontrado`)
    }

    return prisma.cobro.create({
      data: {
        clienteId,
        monto: new Prisma.Decimal(data.monto.toString()),
        moneda: data.moneda,
        referenciaExterna: data.referenciaExterna,
      },
    })
  }

  async procesar(id: bigint) {
    const cobro = await prisma.cobro.findUnique({ where: { id } })

    if (!cobro) {
      throw AppError.notFound(`Cobro ${id} no encontrado`)
    }

    if (cobro.estado !== EstadoCobro.PENDIENTE) {
      throw AppError.conflict(
        `El cobro ${id} ya fue procesado con estado ${cobro.estado}`,
      )
    }

    return prisma.$transaction(async (tx) => {
      const nuevoEstado = await aplicarProcesamiento(
        cobro.id,
        cobro.monto,
        cobro.moneda,
        tx,
      )

      return { ...cobro, estado: nuevoEstado, fechaProceso: new Date() }
    })
  }

  async procesarLote(ids: number[]): Promise<ResultadoLote> {
    const bigIntIds = ids.map((id) => BigInt(id))

    const cobros = await prisma.cobro.findMany({
      where: { id: { in: bigIntIds } },
    })

    const encontradosSet = new Set(cobros.map((c) => Number(c.id)))

    let procesados = 0
    let fallidos = 0
    let omitidos = 0
    const detalle: DetalleItem[] = []

    for (const cobro of cobros) {
      if (cobro.estado !== EstadoCobro.PENDIENTE) {
        omitidos++
        detalle.push({
          id: Number(cobro.id),
          estado: cobro.estado,
          accion: 'OMITIDO',
          motivo: `Ya tiene estado ${cobro.estado}`,
        })
        continue
      }

      const nuevoEstado = await prisma.$transaction(async (tx) =>
        aplicarProcesamiento(cobro.id, cobro.monto, cobro.moneda, tx),
      )

      if (nuevoEstado === EstadoCobro.PROCESADO) procesados++
      else fallidos++

      detalle.push({ id: Number(cobro.id), estado: nuevoEstado, accion: 'PROCESADO' })
    }

    for (const id of ids) {
      if (!encontradosSet.has(id)) {
        omitidos++
        detalle.push({
          id,
          estado: 'NO_ENCONTRADO',
          accion: 'OMITIDO',
          motivo: 'Cobro no encontrado',
        })
      }
    }

    return { total: ids.length, procesados, fallidos, omitidos, detalle }
  }

  async listarPorCliente(clienteId: bigint, filtros: FiltrosCobrosDTO) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })

    if (!cliente) {
      throw AppError.notFound(`Cliente ${clienteId} no encontrado`)
    }

    const where: Prisma.CobroWhereInput = { clienteId }

    if (filtros.estado) {
      where.estado = filtros.estado as EstadoCobro
    }

    if (filtros.desde ?? filtros.hasta) {
      where.fechaCreacion = {
        ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
        ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}),
      }
    }

    return prisma.cobro.findMany({
      where,
      orderBy: { fechaCreacion: 'desc' },
    })
  }
}
