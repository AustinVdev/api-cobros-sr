import type { Request, Response } from 'express'
import { CobrosService } from './cobros.service'
import {
  createCobroSchema,
  procesarLoteSchema,
  filtrosCobrosSchema,
} from './cobros.validators'
import { AppError } from '../../utils/AppError'

const service = new CobrosService()

export const cobrosController = {
  async crear(req: Request, res: Response): Promise<void> {
    const data = createCobroSchema.parse(req.body)
    const cobro = await service.crear(data)
    res.status(201).json({ data: cobro })
  },

  async procesar(req: Request, res: Response): Promise<void> {
    const idNum = Number(req.params['id'])
    if (!Number.isInteger(idNum) || idNum <= 0) {
      throw AppError.badRequest('El parámetro id debe ser un entero positivo')
    }
    const cobro = await service.procesar(BigInt(idNum))
    res.json({ data: cobro })
  },

  async procesarLote(req: Request, res: Response): Promise<void> {
    const { ids } = procesarLoteSchema.parse(req.body)
    const resultado = await service.procesarLote(ids)
    res.json({ data: resultado })
  },

  async listarPorCliente(req: Request, res: Response): Promise<void> {
    const idNum = Number(req.params['id'])
    if (!Number.isInteger(idNum) || idNum <= 0) {
      throw AppError.badRequest('El parámetro id debe ser un entero positivo')
    }
    const filtros = filtrosCobrosSchema.parse(req.query)
    const cobros = await service.listarPorCliente(BigInt(idNum), filtros)
    res.json({ data: cobros })
  },
}
